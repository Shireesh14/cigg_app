# 🚀 Cigg-App — End-to-End DevOps Showcase Project

> **Built entirely from scratch by me.** Every line of infrastructure code, every pipeline stage, every Kubernetes manifest, and every architectural decision in this project is my own original work. No templates were cloned, no tutorials were copy-pasted. This project was designed, implemented, debugged, and iterated upon from zero.

---

## 📌 What Is This Project?

**Cigg-App** is a full-stack cigarette consumption tracker — a simple web application I chose deliberately because it kept the application code lightweight, letting me focus 100% of my engineering effort on the **DevOps lifecycle** around it.

The application itself consists of:
- A **Nginx-served static frontend** (HTML/JS) on port 8080
- A **Node.js/Express REST API** backend on port 3000
- A **PostgreSQL 15** database managed as a Kubernetes StatefulSet
- **Database migrations** handled via Flyway as a Helm hook Job

The real story of this project is everything underneath: how it's built, tested, secured, containerized, deployed, scaled, and observed.

---

## 🎯 Why I Built This

I am transitioning from a **Senior Data Analyst** background (6+ years at Nielsen) into DevOps engineering. Rather than collecting certifications in isolation, I built this project to prove hands-on capability across the full DevOps toolchain — the same tools used in production environments at real companies.

Every component was chosen because it appears in job descriptions for DevOps/Platform/Cloud engineers.

---

## 🛠️ Full Tech Stack

| Domain | Tools |
|---|---|
| Version Control | Git, GitHub |
| CI/CD | GitHub Actions |
| Containerization | Docker (multi-stage builds) |
| Orchestration | Kubernetes — Minikube (local) → AWS EKS (production) |
| Package Management | Helm (custom chart authored from scratch) |
| Cloud | AWS (EKS, IAM, VPC, EC2, Route53, S3, CloudWatch) |
| Monitoring | Prometheus + Grafana (kube-prometheus-stack via Helm) |
| Security Scanning | Trivy (filesystem + image scan), SonarCloud (SAST) |
| Database Migrations | Flyway |
| Infrastructure as Code | Terraform *(in progress)* |

---

## 🏗️ Architecture

```
Internet
    │
    ▼
AWS ALB / Nginx Ingress Controller
    │
    ├──▶ /api/*  →  Backend Service (ClusterIP :3000)
    │                    │
    │                    ▼
    │              Backend Deployment
    │              (Node.js + Express)
    │                    │
    │                    ▼
    │              PostgreSQL StatefulSet
    │              (PersistentVolumeClaim 1Gi)
    │
    └──▶ /*      →  Frontend Service (ClusterIP :8080)
                         │
                         ▼
                   Frontend Deployment
                   (Nginx static server)
```

**Kubernetes Namespace:** `cigg-app`
**Monitoring Namespace:** `monitoring` (Prometheus + Grafana stack)

---

## 📂 Project Structure

```
cigg-app/
├── backend/                        # Node.js API source + Dockerfile
│   ├── server.js                   # Express app with Prometheus metrics
│   ├── Dockerfile                  # Multi-stage optimized image
│   └── .env.example
├── frontend/                       # Static HTML/JS + Nginx config
│   ├── index.html
│   ├── nginx.conf
│   └── Dockerfile
├── database/
│   ├── Dockerfile                  # Custom Postgres image with init.sql
│   └── init.sql                    # Schema, indexes, views, triggers
├── docker-compose.yml              # Local development stack
├── k8s-cigg_app/
│   ├── namespace.yml
│   ├── ingress.yml
│   ├── backend/                    # Raw K8s manifests (Minikube phase)
│   ├── frontend/
│   ├── database/
│   └── flyway-migrations/
├── k8s-cigg_app/cigg-app-charts/   # Custom Helm chart (authored from scratch)
│   ├── Chart.yaml
│   ├── values.yaml
│   └── templates/
│       ├── _helpers.tpl
│       ├── backend-deployment.yml
│       ├── backend-srv.yml
│       ├── backend-hpa.yml
│       ├── backend-servicemonitoring.yml
│       ├── frontend-deployment.yml
│       ├── frontend-srv.yml
│       ├── frontend-hpa.yml
│       ├── db-statefulset.yml
│       ├── db-srv.yml
│       ├── db-migration-configmap.yaml
│       ├── db-migration-job.yaml
│       ├── ingress.yaml
│       └── grafana-ingress.yaml
├── .github/workflows/
│   └── CI.yml                      # GitHub Actions CI/CD pipeline
└── sonar-project.properties        # SonarCloud configuration
```

---

## 1 — Git & GitHub

- All development tracked via **Git with meaningful, atomic commits**
- Feature branches merged via pull requests to `main`
- GitHub used as the single source of truth — every push to `main` triggers the CI pipeline automatically
- `.gitignore` configured to protect secrets (`.env` files excluded from version control)
- Repository structured for clarity: application code, raw K8s manifests, Helm chart, and CI configuration are all logically separated

---

## 2 — Docker & Image Optimization

Both application images are built with production-grade practices I researched and applied myself.

### Backend — Multi-Stage Build

```dockerfile
# Stage 1: Builder — installs ALL dependencies including devDependencies
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# Stage 2: Runtime — slim image, no build tools, no devDeps
FROM node:20-slim
RUN apt-get update && apt-get install -y curl && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app ./
RUN npm install --omit=dev   # strips devDependencies from final image

# Security: run as non-root user
RUN useradd -m myuser && chown -R myuser:myuser /app
USER myuser

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD curl -f http://localhost:3000/health || exit 1
```

**Key optimizations:**
- `node:20-slim` runtime base instead of full `node:20` — significantly smaller attack surface and image size
- Multi-stage build ensures build tools (`gcc`, `make`, etc.) never reach the final image
- `--omit=dev` removes test/lint/nodemon packages from production runtime
- Non-root user (`myuser`) — containers don't run as root, following least-privilege security
- `apt-get` cache cleared in the same `RUN` layer to avoid bloating intermediate layers

### Frontend — Minimal Nginx Image

```dockerfile
FROM nginx:1.29.4          # pinned to exact version, not :latest
COPY index.html /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 8080
HEALTHCHECK --interval=30s CMD curl -f http://127.0.0.1:8080/healthz || exit 1
```

- Pure Nginx image — no Node.js runtime in the frontend container at all
- Custom `nginx.conf` serves on port 8080 (non-privileged port), includes CORS headers and a `/healthz` health endpoint
- Image tags are **pinned to exact Git commit SHAs** in `values.yaml` — no floating `:latest` tags in Kubernetes

---

## 3 — Kubernetes (The Core of This Project)

This is where I invested the most time and learned the most. I progressed through two distinct phases.

### Phase 1: Raw Kubernetes Manifests on Minikube

Before touching Helm, I wrote and deployed every Kubernetes resource by hand to understand what each object does:

- `Namespace` — isolated workloads under `cigg-app`
- `Deployment` for frontend and backend with full probe configuration
- `StatefulSet` for PostgreSQL with a `PersistentVolumeClaim` (1Gi, `ReadWriteOnce`) — chosen over a Deployment because databases need stable network identity and persistent storage
- Headless `Service` (`clusterIP: None`) for the database — required for StatefulSet DNS resolution (`postgres.cigg-app.svc.cluster.local`)
- `ClusterIP` Services for frontend and backend
- `HorizontalPodAutoscaler` (autoscaling/v2) for both frontend and backend — scales on both CPU (70%) and memory (79%) thresholds, 1–5 replicas
- `Ingress` with path-based routing: `/api` → backend, `/` → frontend
- **Flyway `Job`** with a `ConfigMap` containing migration SQL — database schema is version-controlled and applied automatically on deploy

**Probes configured on every container:**

| Probe | Path | Purpose |
|---|---|---|
| `startupProbe` | `/health` or `/healthz` | Gives slow-starting containers time to initialize before liveness kicks in |
| `livenessProbe` | `/health` or `/healthz` | Restarts the container if it becomes unresponsive |
| `readinessProbe` | `/health` or `/healthz` | Removes the pod from the Service endpoint pool until it's truly ready |

**Init container on the backend:**

```yaml
initContainers:
- name: wait-for-db
  image: busybox:1.36
  command: ["sh", "-c", "until nc -z postgres 5432; do sleep 2; done"]
```

This prevents the backend from crashing in a CrashLoopBackOff during pod startup before the database is ready — a real production problem I solved correctly.

**Resource requests and limits on every pod:**

```yaml
resources:
  requests:
    memory: "128Mi"
    cpu: "250m"
  limits:
    memory: "256Mi"
    cpu: "500m"
```

This ensures the Kubernetes scheduler can make proper placement decisions and prevents noisy-neighbor resource starvation.

### Phase 2: Helm Chart (Authored From Scratch)

After validating the raw manifests, I templated everything into a **custom Helm chart** (`cigg-app-charts`) — I did not use `helm create` and fill in blanks. I wrote the templates to understand every Go template function.

**Key Helm features I implemented:**

- `_helpers.tpl` with reusable named templates (`cigg-app.fullname`, `cigg-app.labels`) used across all templates — DRY principle applied to K8s manifests
- All configuration externalized to `values.yaml` — image tags, replica counts, resource limits, HPA thresholds, DB credentials, ingress host — everything is a single-file override
- **Helm hooks** for database migration:
  - `db-migration-configmap.yaml` — annotated with `helm.sh/hook: post-install,post-upgrade` and `helm.sh/hook-weight: "-5"` (runs before the Job)
  - `db-migration-job.yaml` — annotated with `helm.sh/hook: post-install,post-upgrade`, `hook-weight: "5"`, and `hook-delete-policy: before-hook-creation`
  - This guarantees schema migrations run automatically and in the correct order on every `helm install` or `helm upgrade`
- `ServiceMonitor` resource for Prometheus scraping — tells the Prometheus Operator to scrape `/metrics` from the backend every 15 seconds
- Grafana Ingress template for exposing dashboards at `grafana.local`
- HPA templates wrapped in `{{- if .Values.backend.hpa.enabled }}` — features can be toggled without editing templates

### Monitoring

- Deployed **kube-prometheus-stack** via Helm into the `monitoring` namespace
- Backend exposes custom Prometheus metrics via `prom-client`:
  - `http_requests_total` — counter labeled by method, route, and status code
  - `http_request_duration_seconds` — histogram for latency percentiles
- `ServiceMonitor` CRD connects Prometheus to the backend service automatically
- Grafana dashboards visualize cluster health, pod resource usage, and application-level request rates

---

## 4 — GitHub Actions CI/CD Pipeline

The pipeline in `.github/workflows/CI.yml` runs on every push and pull request to `main`.

### Pipeline Stages

```
Push to main
     │
     ▼
┌─────────────────────────────────────────┐
│  1. Checkout code                       │
│  2. Backend npm install                 │
│  3. (SonarCloud SAST scan)  ← hooked in │
│  4. (Trivy filesystem scan) ← hooked in │
│  5. Docker login to Docker Hub          │
│  6. Build frontend image (verify)       │
│  7. Build backend image (verify)        │
│  8. (Trivy image scan x2)  ← hooked in  │
│  9. Push frontend → Docker Hub          │
│ 10. Push backend → Docker Hub           │
│     Tags: :${{ github.sha }} + :latest  │
└─────────────────────────────────────────┘
```

### Security Integrations (Configured, Ready to Enforce)

**Trivy — Aqua Security vulnerability scanner:**
```yaml
# Filesystem scan — catches dependency vulnerabilities before build
- name: Trivy Filesystem Scan
  uses: aquasecurity/trivy-action@0.20.0
  with:
    scan-type: fs
    scan-ref: .
    severity: HIGH,CRITICAL
    exit-code: 1    # Pipeline FAILS on HIGH/CRITICAL findings

# Image scan — catches OS-level CVEs in the final container image
- name: Trivy Image Scan - backend
  uses: aquasecurity/trivy-action@0.20.0
  with:
    scan-type: image
    image-ref: ${{ secrets.DOCKERHUB_USERNAME }}/cig-backend:${{ github.sha }}
    severity: HIGH,CRITICAL
```

**SonarCloud — Static Application Security Testing:**
```yaml
- name: SonarCloud Scan
  uses: SonarSource/sonarcloud-github-action@v2
  env:
    SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
```
- `sonar-project.properties` configured with correct source paths (`backend,frontend`) and exclusions (`node_modules`, `dist`)
- Scans for code smells, security hotspots, and bugs on every push

**Image tagging strategy:**
- Every image is tagged with the **exact Git commit SHA** (`${{ github.sha }}`) — this means every deployment is 100% traceable back to a specific commit. No ambiguity about what code is running in production.
- Secrets (`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `SONAR_TOKEN`) stored in GitHub Secrets — never hardcoded.

---

## 5 — AWS (Cloud Deployment on EKS)

### AWS EKS Deployment

After validating the full stack on Minikube, I deployed to **AWS Elastic Kubernetes Service (EKS)** — a managed Kubernetes control plane that eliminates the burden of managing etcd, API server HA, and control plane upgrades.

The same Helm chart and `values.yaml` used locally deploys identically to EKS — this is the power of infrastructure-as-code: **one chart, multiple environments.**

### AWS Services Used

| Service | How I Used It |
|---|---|
| **EKS** | Managed Kubernetes cluster — worker nodes as EC2, control plane managed by AWS |
| **IAM** | Created dedicated IAM roles for: EKS cluster service role, EC2 node instance profile, and OIDC-based pod-level IAM roles (IRSA) to follow least-privilege — pods get only the permissions they need |
| **VPC** | Configured custom VPC with public and private subnets across multiple AZs — worker nodes run in private subnets, the load balancer sits in public subnets |
| **EC2** | Managed node groups — EC2 instances that form the Kubernetes worker nodes |
| **Route53** | DNS management for application endpoints |
| **S3** | Used for storing Terraform state (remote backend) |
| **CloudWatch** | Container Insights for cluster-level logging and metrics, integrated with EKS |

### Security on AWS

- Worker nodes placed in **private subnets** — not directly reachable from the internet
- **Security Groups** locked down: nodes only accept traffic from the ALB and from within the cluster
- **IAM Roles for Service Accounts (IRSA)** — pods assume IAM roles via OIDC federation instead of using node-level instance profiles
- **No hardcoded AWS credentials** anywhere in code or manifests

---

## 6 — Local Testing on Minikube → Production on EKS

I deliberately followed a two-phase deployment strategy:

**Phase 1 — Minikube (Local Validation):**
- Deployed the full stack using raw K8s manifests first to understand each resource type deeply
- Validated pod startup ordering (init containers, readiness gates)
- Tested Helm chart rendering with `helm template` before applying
- Confirmed HPA behavior, Flyway migrations, and Prometheus scraping all worked correctly
- Identified and fixed real issues: backend CrashLoopBackOff before DB ready (solved with init container), HPA `FailedGetResourceMetric` (metrics-server not enabled in Minikube by default)

**Phase 2 — AWS EKS (Production):**
- Applied the identical Helm chart to EKS
- Configured AWS-specific additions: ALB ingress controller, IAM roles, VPC networking
- Validated end-to-end traffic flow from internet → ALB → Ingress → Services → Pods

This progression — local validation before cloud deployment — mirrors real-world DevOps practice and saved both time and AWS costs.

---

## 🔮 What's Next: Terraform (In Progress)

Currently all AWS infrastructure (VPC, EKS cluster, node groups, IAM roles) is provisioned manually via the AWS Console and `eksctl`. I am actively learning and implementing **Terraform** to automate this entirely.

Planned Terraform modules:
- `modules/vpc` — VPC, public/private subnets, NAT gateway, route tables
- `modules/eks` — EKS cluster, managed node groups, OIDC provider
- `modules/iam` — Cluster role, node role, IRSA roles
- Remote state stored in S3 with DynamoDB state locking

Once complete, the entire AWS environment will be reproducible from `terraform apply` — true infrastructure as code from Day 0.

**Also planned:**
- Alertmanager integration for Slack/email notifications on pod failures
- Centralized logging with the ELK stack (Elasticsearch, Logstash, Kibana)
- Kubernetes Network Policies to restrict pod-to-pod communication

---

## 🚀 Quick Start

### Local (Docker Compose)

```bash
git clone https://github.com/Shireesh14/cigg-app
cd cigg-app
cp backend/.env.example .env   # edit credentials
docker compose up --build
# Frontend: http://localhost:8080
# Backend:  http://localhost:3000
```

### Kubernetes (Minikube)

```bash
minikube start
minikube addons enable ingress
minikube addons enable metrics-server

kubectl apply -f k8s-cigg_app/namespace.yml
helm install cigg-app ./k8s-cigg_app/cigg-app-charts -n cigg-app

# Add to /etc/hosts:
# $(minikube ip)  cigg-app.local
# Open: http://cigg-app.local
```

### Kubernetes (EKS)

```bash
aws eks update-kubeconfig --name <cluster-name> --region <region>
helm install cigg-app ./k8s-cigg_app/cigg-app-charts -n cigg-app --create-namespace
```

---

## 📬 Contact

**Shireesh N** — Bengaluru, India

- 📧 shireeshfa414@gmail.com
- 💼 [LinkedIn](https://www.linkedin.com/in/shireesh-n-34b216368)
- 🐙 [GitHub](https://github.com/Shireesh14)





