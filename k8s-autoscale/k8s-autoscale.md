# ZeroLeak — Autoscaled Kubernetes Deployment

This directory provides dynamic **Horizontal Pod Autoscaling (HPA)** for the ZeroLeak platform.

- Use **[`k8s/`](../k8s)** when you want to run pods **normally with fixed replicas** (2 backend, 2 frontend).
- Use **`k8s-autoscale/`** when you want pods to **dynamically scale up and down** based on student exam traffic.

---

## Autoscaling Specifications

| Component | Target Deployment | Min Pods | Max Pods | Scaling Triggers |
| :--- | :--- | :---: | :---: | :--- |
| **Backend API** | `deployment/backend` | **2** | **10** | CPU > 70% or Memory > 80% |
| **Frontend UI** | `deployment/frontend` | **2** | **10** | CPU > 75% or Memory > 80% |

### Scale-Up & Scale-Down Behavior
- **Scale-Up**: Immediate (no stabilization delay). Can double pods every 15 seconds to absorb sudden exam submission surges.
- **Scale-Down**: 300-second (5-minute) stabilization window to prevent flapping/thrashing after short traffic drops.

---

## Prerequisites: Metrics Server

HPA requires the Kubernetes Metrics Server to be active in your cluster so it can monitor CPU/memory usage.

- **Cloud Providers (GKE, EKS, DOKS, Civo)**: Metrics Server is typically pre-installed.
- **Minikube**:
  ```bash
  minikube addons enable metrics-server
  ```
- **KinD / Custom Cluster**:
  ```bash
  kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
  ```

---

## Deployment Commands

### Option A: Deploy WITH Autoscaling

To deploy the entire ZeroLeak stack with autoscaling enabled:

```bash
kubectl apply -k k8s-autoscale/
```

### Option B: Deploy WITHOUT Autoscaling (Fixed Replicas)

To deploy normally with fixed 2 backend and 2 frontend pods:

```bash
kubectl apply -k k8s/
```

### Option C: Toggle Autoscaling on an Existing Deployment

- **Enable autoscaling** on a currently running cluster:
  ```bash
  kubectl apply -f k8s-autoscale/hpa-backend.yaml
  kubectl apply -f k8s-autoscale/hpa-frontend.yaml
  ```

- **Disable autoscaling** and return to fixed replicas:
  ```bash
  kubectl delete -f k8s-autoscale/hpa-backend.yaml
  kubectl delete -f k8s-autoscale/hpa-frontend.yaml
  ```

---

## Monitoring Autoscaling in Real-Time

Check current CPU/Memory targets and active replica counts:

```bash
kubectl -n zeroleak get hpa
```

Watch scaling events in real-time as traffic occurs:

```bash
kubectl -n zeroleak get hpa -w
```
