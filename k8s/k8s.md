# Kubernetes Deployment for ZeroLeak

This directory contains production-ready Kubernetes manifests for deploying the ZeroLeak platform.

## Architecture

The Kubernetes architecture consists of:
- **`zeroleak` Namespace**: Isolated namespace for all components.
- **ConfigMap & Secret**: Centralized management of application parameters, connection strings, and encryption keys.
- **MongoDB StatefulSet**: Stateful deployment with PersistentVolumeClaim (`10Gi`) and `mongosh` health probes.
- **Redis Deployment**: In-memory cache with PersistentVolumeClaim (`2Gi`) and password authentication.
- **Backend Deployment**: High-availability Node.js service (2 replicas) with rolling updates, HTTP liveness/readiness probes (`/api/health`), and non-root security context.
- **Frontend Deployment**: High-availability Nginx container (2 replicas) serving built SPA assets with `/healthz` probe.
- **Ingress**: Reverse proxy routing `/api` and `/socket.io` to the backend and `/` to the frontend with WebSocket support and 50MB body limit.

---

## Prerequisites

1. Kubernetes cluster (v1.24+) (Minikube, Kind, EKS, GKE, AKS)
2. `kubectl` CLI installed
3. Ingress controller (e.g., `ingress-nginx`) enabled in your cluster

---

## Quickstart Deployment

### 1. Build and Tag Container Images

```bash
# Build backend
docker build -t zeroleak-backend:latest ./backend

# Build frontend
docker build -t zeroleak-frontend:latest ./frontend
```

*(If using Minikube, run `eval $(minikube docker-env)` prior to building, or load them into Kind using `kind load docker-image zeroleak-backend:latest zeroleak-frontend:latest`).*

### 2. Configure Secrets

Before applying in production, edit `k8s/secret.yaml` or generate new secrets:

- `ACCESS_TOKEN_SECRET`: Run `openssl rand -base64 32`
- `QUESTION_ENCRYPTION_KEY`: Run `openssl rand -base64 32`
- `MONGO_PASSWORD`: Choose a strong password
- `REDIS_PASSWORD`: Choose a strong password
- `GROQ_API_KEY`: Provide your Groq LLM API key if using AI generation

### 3. Deploy Stack

Deploy all resources in a single command using Kustomize:

```bash
kubectl apply -k k8s/
```

### 4. Verify Pods and Services

Check rollout status:

```bash
kubectl -n zeroleak get pods -o wide
kubectl -n zeroleak get svc
kubectl -n zeroleak get ingress
```

Wait until all pods are running and ready:

```bash
kubectl -n zeroleak wait --for=condition=ready pod -l app.kubernetes.io/name=backend --timeout=90s
kubectl -n zeroleak wait --for=condition=ready pod -l app.kubernetes.io/name=frontend --timeout=60s
```

### 5. Accessing the Application

- **With Ingress Controller**:
  Add `zeroleak.local` (or your ingress IP/host) to `/etc/hosts` or use your domain name.
- **Port Forwarding (Testing without Ingress)**:
  ```bash
  # Access Frontend UI
  kubectl -n zeroleak port-forward svc/frontend 8080:80

  # Access Backend API directly
  kubectl -n zeroleak port-forward svc/backend 4000:4000
  ```

---

## Teardown

To delete all resources in the `zeroleak` namespace:

```bash
kubectl delete -k k8s/
```
