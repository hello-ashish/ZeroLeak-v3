# ZeroLeak — Complete Execution & Deployment Guide

This document contains step-by-step instructions for running the **ZeroLeak** platform and its **Hyperledger Fabric** blockchain across all supported deployment methods:

1. [Hyperledger Fabric Blockchain Setup (Common to All Methods)](#0-hyperledger-fabric-blockchain-setup)
2. [Method 1: Local Bare-Metal Development (Node.js + Vite)](#method-1-local-bare-metal-development-nodejs--vite)
3. [Method 2: Docker Compose — Development Mode (Live Hot-Reload)](#method-2-docker-compose--development-mode-live-hot-reload)
4. [Method 3: Docker Compose — Production Mode (Compiled SPA + Nginx)](#method-3-docker-compose--production-mode-compiled-spa--nginx)
5. [Method 4: Kubernetes — Standard Deployment (Fixed Replicas)](#method-4-kubernetes--standard-deployment-fixed-replicas)
6. [Method 5: Kubernetes — Autoscaled Deployment (HPA Dynamic Scaling)](#method-5-kubernetes--autoscaled-deployment-hpa-dynamic-scaling)
7. [Service Ports & Access URLs Reference](#service-ports--access-urls-reference)
8. [Default Portal Test Credentials](#default-portal-test-credentials)
9. [Troubleshooting & FAQ](#troubleshooting--faq)

---

## 0. Hyperledger Fabric Blockchain Setup

ZeroLeak uses an enterprise Hyperledger Fabric network (`zeroleak-channel`, chaincode `zeroleak` v1.0) to record cryptographic Merkle roots for Question Batches, Exam Papers, and Student Results.

Because Fabric runs as a consortium network of Docker containers on your host machine, **start it first** whenever you need blockchain verification:

```bash
# 1. Bring up the Fabric peer nodes, orderer, and channel
npm run fabric:up

# 2. Compile TypeScript chaincode and deploy to zeroleak-channel
npm run fabric:deploy
```

### Useful Fabric Inspection Commands:
```bash
# Check running Fabric containers, channel, and chaincode commit readiness
npm run fabric:status

# Inspect current blockchain height, latest block data, and Merkle transactions
npm run fabric:block

# Shut down the Fabric network and clean crypto volumes when finished
npm run fabric:down
```

---

## Method 1: Local Bare-Metal Development (Node.js + Vite)

*Best for rapid frontend/backend development and debugging.*

### Prerequisites:
- Node.js v20+
- Dependencies installed (`npm run install:all`)
- Hyperledger Fabric running (see [Section 0](#0-hyperledger-fabric-blockchain-setup))

### Step 1: Start Backend
In a new terminal window:
```bash
cd backend
npm run dev
```
*Backend runs on: `http://localhost:4000`*

### Step 2: Start Frontend
In a second terminal window:
```bash
cd frontend
npm run dev
```
*Frontend runs on: `http://localhost:5173`*

### Step 3: Stop Services
Press `Ctrl + C` in both terminal windows. To stop Fabric: `npm run fabric:down`.

---

## Method 2: Docker Compose — Development Mode (Live Hot-Reload)

*Best for running all databases, backend, and frontend in Docker with source code mounted for live editing.*

### Step 1: Start Hyperledger Fabric
```bash
npm run fabric:up
npm run fabric:deploy
```

### Step 2: Launch Docker Compose Stack
```bash
# Builds and starts MongoDB, Redis, Backend (dev), and Frontend (dev)
docker compose up --build
```
*(or run: `npm run docker:up`)*

To run in the background (detached mode):
```bash
docker compose up -d --build
```

### Step 3: Access Application
* **Frontend UI**: [http://localhost:5173](http://localhost:5173)
* **Backend API**: [http://localhost:4000](http://localhost:4000)
* **API Health Check**: `curl http://localhost:4000/api/health`

### Step 4: Stop Containers
```bash
docker compose down
```
*(or run: `npm run docker:down`)*

---

## Method 3: Docker Compose — Production Mode (Compiled SPA + Nginx)

*Best for staging tests with compiled production frontend assets served by Nginx.*

### Step 1: Start Hyperledger Fabric
```bash
npm run fabric:up
npm run fabric:deploy
```

### Step 2: Launch Production Docker Compose Profile
```bash
# Builds production target with Nginx reverse proxy
docker compose --profile production up --build
```
*(or run: `npm run docker:prod`)*

### Step 3: Access Application
* **Frontend UI (Nginx)**: [http://localhost:80](http://localhost:80)
* **Backend API**: [http://localhost:4000](http://localhost:4000)

### Step 4: Stop Production Containers
```bash
docker compose --profile production down
```

---

## Method 4: Kubernetes — Standard Deployment (Fixed Replicas)

*Best for running on a local cluster (Docker Desktop Kubernetes, Minikube, or KinD) with fixed pod counts (2 backend pods, 2 frontend pods).*

### Prerequisites:
1. Ensure Kubernetes is running (`kubectl cluster-info`).
2. If using Docker Desktop: enable Kubernetes in **Docker Desktop Settings -> Kubernetes -> Enable Kubernetes**.

### Step 1: Start Hyperledger Fabric
```bash
npm run fabric:up
npm run fabric:deploy
```

### Step 2: Build & Tag Container Images
```bash
docker build -t zeroleak-backend:latest ./backend
docker build -t zeroleak-frontend:latest ./frontend
```
*(If using KinD: `kind load docker-image zeroleak-backend:latest zeroleak-frontend:latest`)*

### Step 3: Deploy via Kustomize
```bash
kubectl apply -k k8s/

# (Optional) Apply your local secrets if overriding default placeholders:
kubectl apply -f k8s/secret.local.yaml
```

### Step 4: Verify Rollout Status
```bash
# Check pods in the zeroleak namespace
kubectl -n zeroleak get pods -o wide

# Wait for deployments to be ready
kubectl -n zeroleak rollout status deployment/backend
kubectl -n zeroleak rollout status deployment/frontend
```

### Step 5: Access Application
Forward the service ports to your Mac:
```bash
# Open frontend in your browser at http://localhost:5173
kubectl -n zeroleak port-forward svc/frontend 5173:80

# (Optional) Open backend API directly at http://localhost:4000
kubectl -n zeroleak port-forward svc/backend 4000:4000
```

### Step 6: Teardown
```bash
kubectl delete -k k8s/
npm run fabric:down
```

---

## Method 5: Kubernetes — Autoscaled Deployment (HPA Dynamic Scaling)

*Best for simulating exam load where pods dynamically scale up from 2 to 10 based on CPU/RAM traffic surges.*

### Step 1: Enable Metrics Server (Required for Autoscaling)
On Docker Desktop / KinD:
```bash
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system --type 'json' -p '[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
```
*(Verify metrics with: `kubectl top nodes`)*

### Step 2: Start Hyperledger Fabric
```bash
npm run fabric:up
npm run fabric:deploy
```

### Step 3: Build & Tag Container Images
```bash
docker build -t zeroleak-backend:latest ./backend
docker build -t zeroleak-frontend:latest ./frontend
```

### Step 4: Deploy Stack With Autoscaling
```bash
kubectl apply -k k8s-autoscale/

# (Optional) Apply your local secrets if overriding default placeholders:
kubectl apply -f k8s/secret.local.yaml
```

### Step 5: Monitor Autoscaling in Real-Time
Open a terminal to watch the Horizontal Pod Autoscalers:
```bash
kubectl -n zeroleak get hpa -w
```
*Autoscaling Policy:*
* **Backend HPA**: 2 to 10 pods (Triggers when CPU > 70% or RAM > 80%).
* **Frontend HPA**: 2 to 10 pods (Triggers when CPU > 75% or RAM > 80%).
* **Scale-Up**: Immediate (can double pods every 15s to handle student exam starts).
* **Scale-Down**: 300s (5 min) cooldown to prevent flapping.

### Step 6: Access Application
```bash
kubectl -n zeroleak port-forward svc/frontend 8080:80
```
Open **[http://localhost:8080](http://localhost:8080)** in your browser.

### Step 7: Simulate Traffic Spike (Demo)
In another terminal, simulate traffic to watch the backend scale from 2 pods to 10:
```bash
kubectl run -i --tty load-test --rm --image=busybox:1.28 --restart=Never -- /bin/sh -c \
  "while true; do wget -q -O- http://backend.zeroleak.svc.cluster.local:4000/api/health > /dev/null; done"
```
Stop the test with `Ctrl + C` and observe the pods scale back down after the cooldown.

### Step 8: Teardown
```bash
kubectl delete -k k8s-autoscale/
npm run fabric:down
```

---

## Service Ports & Access URLs Reference

| Component | Dev Port | Prod / K8s Port | Description |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | `5173` | `80` (or `8080` port-forward) | React + Vite Academic Command Center |
| **Backend API** | `4000` | `4000` | Express REST API + WebSocket server |
| **MongoDB** | `27017` | `27017` | Document Database |
| **Redis** | `6379` | `6379` | Cache & Session Store |
| **Fabric Peer 0 (Org1)** | `7051` | `7051` (host.docker.internal) | Hyperledger Fabric gRPC Gateway |
| **Fabric Peer 0 (Org2)** | `9051` | `9051` (host.docker.internal) | Hyperledger Fabric Org2 Peer |
| **Fabric Orderer** | `7050` | `7050` | Raft Consensus Ordering Service |

---

## Default Portal Test Credentials

| Role | Portal Login Path | Default Email | Default Password |
| :--- | :--- | :--- | :--- |
| **Admin** | `/admin/login` | `admin@zeroleak.com` | `admin123` |
| **Professor** | `/professor/login` | `prof.sharma@zeroleak.com` | `prof123` |
| **Student** | `/student/login` | `student1@zeroleak.com` | `student123` |
| **Auditor** | `/auditor/login` | `auditor@zeroleak.com` | `auditor123` |
| **Support** | `/support/login` | `support@zeroleak.com` | `support123` |

---

## Troubleshooting & FAQ

### 1. Fabric Peer connection fails from inside Docker or Kubernetes
* When running inside Docker or Kubernetes, the backend reaches the host machine using `host.docker.internal:7051`.
* Ensure Docker Desktop has "Allow host networking" or host resolution enabled.
* Verify the peer is listening: `nc -zv localhost 7051`.

### 2. Kubernetes Metrics Server reports `Metrics API not available`
* Ensure the `--kubelet-insecure-tls` flag is present on the `metrics-server` deployment in Docker Desktop:
  ```bash
  kubectl patch deployment metrics-server -n kube-system --type 'json' -p '[{"op": "add", "path": "/spec/template/spec/containers/0/args/-", "value": "--kubelet-insecure-tls"}]'
  ```

### 3. Port collisions (e.g. `port 4000 already in use`)
* If running local development (`npm run dev`) and you attempt to start Docker or port-forwarding, stop the local dev processes first:
  ```bash
  lsof -ti:4000,5173 | xargs kill -9
  ```

### 4. Resetting everything clean
```bash
# Clean Kubernetes
kubectl delete namespace zeroleak --ignore-not-found=true

# Clean Docker
docker compose down -v --remove-orphans

# Clean Fabric
npm run fabric:down
```

---

## Method 7: Public Sharing & Custom Domain (Cloudflare Tunnel)

### Option A: Instant Public Link (No Account / Free Quick Tunnel)
First, ensure the frontend port-forward is running:
```bash
kubectl -n zeroleak port-forward svc/frontend 8080:80
```
In another terminal, generate an instant secure HTTPS public URL:
```bash
cloudflared tunnel --url http://localhost:8080
```
*(Outputs an instant `https://<unique-name>.trycloudflare.com` URL accessible by anyone without signing up or opening router ports).*

### Option B: Permanent Custom Domain (Named Tunnel)
To route your own domain (e.g. `zeroleak.yourdomain.com`):
```bash
# 1. Login to Cloudflare
cloudflared login

# 2. Create the tunnel
cloudflared tunnel create zeroleak

# 3. Route your custom domain / subdomain
cloudflared tunnel route dns zeroleak zeroleak.yourdomain.com

# 4. Start the tunnel
cloudflared tunnel run zeroleak
```
