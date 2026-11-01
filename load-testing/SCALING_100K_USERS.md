# VeerSeva - Scaling Architecture to 100,000+ Concurrent Defense Users

This document outlines the architectural blueprint, infrastructure topology, and tuning parameters required to scale the VeerSeva platform from thousands to **100,000+ concurrent active veterans and defense officers**.

---

## 1. System Architecture Diagram

```
                     +----------------------------+
                     | Cloudflare / Akamai CDN    | (Edge Caching, DDoS Shield, WAF)
                     +-------------+--------------+
                                   |
                     +-------------v--------------+
                     | Nginx Reverse Proxy Cluster| (SSL Termination, Least-Conn Balancer)
                     +-------------+--------------+
                                   |
         +-------------------------+-------------------------+
         |                         |                         |
+--------v-------+        +--------v-------+        +--------v-------+
| VeerSeva API-1 |        | VeerSeva API-2 |        | VeerSeva API-N | (Stateless Node.js Instances)
+--------+-------+        +--------+-------+        +--------+-------+
         |                         |                         |
         +-------------------------+-------------------------+
                                   |
         +-------------------------+-------------------------+
         |                                                   |
+--------v---------------+                  +----------------v----------------+
| Redis Cluster          |                  | MySQL 8.x Cluster (ProxySQL)    |
| - Distributed Sessions |                  | - Primary Node (Writes)         |
| - Token Revocation List|                  | - Read Replicas (Read Traffic)  |
| - Sliding Rate Limits  |                  | - Range Partitioned Audit Logs  |
| - BullMQ Job Queues    |                  +---------------------------------+
+------------------------+
```

---

## 2. Horizontal Scaling & Kubernetes (K8s) Topology

Because the Express.js API tier is completely stateless (session tokens and rotation tracking reside in Redis/MySQL), API instances can scale dynamically using the **Horizontal Pod Autoscaler (HPA)** based on CPU utilization and request rate:

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: veerseva-api-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: veerseva-api
  minReplicas: 10
  maxReplicas: 120
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 65
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 800m
```

---

## 3. Database Layer Optimization (MySQL 8.x)

### 3.1 Connection Pool Sizing
- In high-concurrency environments, setting connection limits too high exhausts database threads.
- Instead of allocating 500 connections per pod, use **ProxySQL** as a middle connection multiplexer:
  - `ProxySQL` maintains 200 persistent backend connections to MySQL Primary.
  - Front-end API instances connect to ProxySQL with a pool size of 15-20 per pod.

### 3.2 Read/Write Splitting
- 92% of defense veteran requests are **reads** (checking pension slips, searching ECHS hospitals, viewing CSD catalog, checking PMSS status).
- Route all `SELECT` queries to **Read Replicas** via ProxySQL query rules.
- Route write operations (`INSERT`, `UPDATE`, `PATCH`) to the MySQL Primary node.

### 3.3 Indexing & Partitioning Strategy
- Milestone 1 establishes critical B-Tree indexes:
  - `users(service_number)`, `users(assigned_district)`
  - `esm_profiles(service_number)`, `esm_profiles(district)`
  - `applications(status)`, `applications(esm_id)`, `applications(submitted_at)`
- Partition the `audit_logs` table by range on the `timestamp` column. This enables instant dropping of partitions older than 180 days to fulfill CERT-In retention guidelines without expensive `DELETE` locks:
  ```sql
  ALTER TABLE audit_logs PARTITION BY RANGE (UNIX_TIMESTAMP(timestamp)) (
    PARTITION p2026_q1 VALUES LESS THAN (UNIX_TIMESTAMP('2026-04-01 00:00:00')),
    PARTITION p2026_q2 VALUES LESS THAN (UNIX_TIMESTAMP('2026-07-01 00:00:00')),
    PARTITION p2026_q3 VALUES LESS THAN (UNIX_TIMESTAMP('2026-10-01 00:00:00')),
    PARTITION p_future VALUES LESS THAN MAXVALUE
  );
  ```

---

## 4. Redis Cluster & Session Management

### 4.1 Token Revocation via Redis Bloom Filter / Set
- With 100k+ users, querying a database for revoked tokens creates bottlenecking.
- Revoked JWT `jti` IDs are stored in a Redis Set with a TTL matching the token's lifetime (15 minutes).
- Session verification performs an `O(1)` memory check in Redis before admitting requests.

### 4.2 Distributed Rate Limiting
- Use Redis Sliding Window or Token Bucket algorithms (`ioredis` + Lua scripts) across all Nginx and API nodes to thwart credential stuffing attacks against defense service numbers.

---

## 5. Background Asynchronous Queues (BullMQ)

High-latency tasks should never block user-facing HTTP request threads:
1. **Scraper Sync Workers**: CSD catalog, SPARSH pension, and DGR jobs scrapers execute in independent background worker pods scheduled via BullMQ.
2. **OTP Dispatch**: SMS / Email dispatching runs via queue jobs with exponential backoff retry.
3. **PDF Generation**: Monthly pension slip rendering and DigiLocker document archiving are dispatched to specialized PDF rendering worker instances.

---

## 6. Static Asset Caching & PWA Optimization

- **Cloudflare / Akamai Edge Caching**:
  - Cache static CSS, JS, SVG badges, and i18n JSON files at edge points of presence across India (Mumbai, Delhi, Chennai, Bengaluru, Kolkata).
  - Serve compressed Brotli assets with `Cache-Control: public, max-age=31536000, immutable`.
- **PWA Service Worker**:
  - The client PWA caches all shell assets locally, drastically reducing server hits on subsequent visits.
  - The client only requests dynamic data payloads (`/api/v1/benefits/*`), keeping average response payloads under 12 KB.

---

## 7. Capacity Estimation Table

| Layer | Requirement for 100k Concurrent Users | Recommended Sizing |
| :--- | :--- | :--- |
| **API Tier** | 100k concurrent active connections (~12,500 req/sec) | 35-50 K8s Pods (2 vCPU, 2GB RAM each) |
| **Redis** | Active session records & rate limit cache | 3-Node Redis Cluster (8GB RAM per node) |
| **MySQL Primary** | Write traffic (~800 writes/sec) | 16 vCPU, 64GB RAM, NVMe SSD (IOPS: 10,000+) |
| **MySQL Replicas** | Read queries (~11,700 reads/sec) | 3 Read Replicas (8 vCPU, 32GB RAM each) |
| **Bandwidth** | Avg 15 KB/sec per active session | ~1.5 Gbps redundant uplink |
