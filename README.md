# Power Snapshot NG — ECS Express Mode

A minimal single-container web app for learning **Amazon ECS Express Mode**, focused on **Nigeria electricity data**.

It serves a small UI and two API routes from one Node.js process on **port 80**:

| Route | Purpose |
|-------|---------|
| `/` | Page showing Nigeria electricity indicators |
| `/api/energy` | JSON from the [World Bank Open Data API](https://data.worldbank.org/country/nigeria) |
| `/api/health` | Health check for the ALB (returns HTTP 200) |

> **Note on data:** The UK has a free live grid carbon API. Nigeria does not publish an equivalent open real-time feed — so this app uses the latest official World Bank statistics (access %, consumption per capita, renewable share). Same deployment story, honest data sourcing.

> **As of mid-2026:** ECS Express Mode is available in all regions where ECS and Fargate are supported. Console labels may shift slightly — match what you see in AWS.

---

## What you'll build

**[Screenshot: browser at your auto-generated `https://<service>.ecs.<region>.on.aws` URL, showing Power Snapshot NG with Nigeria flag and electricity access %]**

A tiny web service that returns a real slice of Nigeria energy data — electricity access, consumption, and renewable share — fetched from a public API and displayed in the browser. Deliberately simple so nothing distracts from the deployment, but more interesting than "hello world."

If you'd rather ship your own image, every step below still applies.

---

## Prerequisites

- An **AWS account** with permissions for ECS, ECR, IAM, and CloudWatch
- **AWS CLI v2** installed and configured (`aws configure`)
- **Docker Desktop** installed and running
- You'll push a container image to **Amazon ECR** (Step 2)

---

## Step 1 — Build your container image

All commands below run from this folder (`express-mode/`).

### 1.1 Build

```powershell
docker build -t power-snapshot-ng .
```

**What the Dockerfile does (line by line):**

| Line | Meaning |
|------|---------|
| `FROM node:20-alpine` | Small Linux base with Node.js 20 |
| `COPY package*.json` + `npm install` | Install dependencies first (Docker layer cache) |
| `COPY server.js` + `public/` | Application code |
| `ENV PORT=80` | Listen on port 80 inside the container |
| `EXPOSE 80` | Documents the port for humans and tooling |
| `CMD ["node", "server.js"]` | Start the web server |

### 1.2 Run locally

```powershell
docker run -p 8080:80 --name power-test power-snapshot-ng
```

### 1.3 Verify before AWS

Open **http://localhost:8080** — you should see Nigeria electricity indicators (access % highlighted).

```powershell
curl http://localhost:8080/api/health
curl http://localhost:8080/api/energy
```

Expected health response:

```json
{"status":"ok"}
```

Stop the test container:

```powershell
docker stop power-test
docker rm power-test
```

---

## Step 2 — Push the image to ECR

Set your region and account ID:

```powershell
$env:AWS_REGION = "us-east-1"
$env:AWS_ACCOUNT_ID = aws sts get-caller-identity --query Account --output text
```

### 2.1 Create repository

```powershell
aws ecr create-repository --repository-name power-snapshot-ng --region $env:AWS_REGION
```

(Skip if the repo already exists.)

### 2.2 Authenticate Docker to ECR

```powershell
aws ecr get-login-password --region $env:AWS_REGION | docker login --username AWS --password-stdin "$env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com"
```

### 2.3 Tag and push

```powershell
docker tag power-snapshot-ng:latest "$env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com/power-snapshot-ng:latest"

docker push "$env:AWS_ACCOUNT_ID.dkr.ecr.$env:AWS_REGION.amazonaws.com/power-snapshot-ng:latest"
```

### 2.4 Verify in console

1. Open **Amazon ECR**
2. Select **power-snapshot-ng**
3. Confirm the `latest` image is listed

Save your image URI:

```
<ACCOUNT_ID>.dkr.ecr.<REGION>.amazonaws.com/power-snapshot-ng:latest
```

---

## Step 3 — Create the two IAM roles

Express Mode needs **three inputs**: container image, task execution role, infrastructure role.

| Role | Plain English | Managed policy |
|------|---------------|----------------|
| **Task execution role** | Lets ECS pull your ECR image and write CloudWatch logs | `AmazonECSTaskExecutionRolePolicy` |
| **Infrastructure role** | Lets Express Mode create the ALB, security groups, scaling, etc. | `AmazonECSInfrastructureRolePolicyForExpressServices` |

### Option A — Console shortcut (easiest)

When creating the Express Mode service (Step 4), choose **Create new role** in each role dropdown. AWS attaches the correct policies.

### Option B — Create manually in IAM

**Execution role:**

1. IAM → Roles → Create role
2. Trusted entity: **Elastic Container Service** → **Elastic Container Service Task**
3. Attach `AmazonECSTaskExecutionRolePolicy`
4. Name: `ecsTaskExecutionRole`

**Infrastructure role:**

1. IAM → Roles → Create role
2. Trusted entity: **Elastic Container Service**
3. Attach `AmazonECSInfrastructureRolePolicyForExpressServices`
4. Name: `ecsInfrastructureRoleForExpressServices`

---

## Step 4 — Deploy with Express Mode

### 4.1 Open the wizard

1. AWS Console → **Amazon ECS**
2. Left nav → **Express mode**
3. **Create**

### 4.2 Configure this app

| Field | Value |
|-------|-------|
| Container image URI | `<account>.dkr.ecr.<region>.amazonaws.com/grid-snapshot:latest` |
| Task execution role | `ecsTaskExecutionRole` |
| Infrastructure role | `ecsInfrastructureRoleForExpressServices` |
| Service name | `power-snapshot-ng` |

Expand **Additional configurations**:

| Field | Value | Why |
|-------|-------|-----|
| **Container port** | `80` | App listens on port 80 |
| **Health check path** | `/api/health` | Default is `/ping` — this app doesn't have that route |

Defaults if you change nothing else: **1 vCPU**, **2 GB RAM**, CPU-based auto scaling, HTTPS URL on `*.ecs.<region>.on.aws`.

### 4.3 Create and wait

Choose **Create**. Watch the **Timeline** on the Resources tab. Provisioning usually takes a few minutes.

### 4.4 Open your live URL

When status is **Running**, open the URL (e.g. `https://power-snapshot-ng.ecs.us-east-1.on.aws`).

**Screenshot the win.**

### 4.5 CLI alternative

```powershell
aws ecs create-express-gateway-service `
  --region $env:AWS_REGION `
  --service-name power-snapshot-ng `
  --execution-role-arn "arn:aws:iam::${env:AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole" `
  --infrastructure-role-arn "arn:aws:iam::${env:AWS_ACCOUNT_ID}:role/ecsInfrastructureRoleForExpressServices" `
  --primary-container "image=${env:AWS_ACCOUNT_ID}.dkr.ecr.${env:AWS_REGION}.amazonaws.com/power-snapshot-ng:latest,containerPort=80" `
  --health-check-path "/api/health" `
  --monitor-resources
```

Docs: [Create your first Express Mode service using the AWS CLI](https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-getting-started.html)

---

## What Express Mode did for you

Without Express Mode you'd configure, at minimum:

- ECS cluster and service
- Task definition
- Application Load Balancer + target group + listener
- Security groups
- Auto scaling policies
- CloudWatch logging
- HTTPS URL

Express Mode provisions all of that from your **image + two roles**. Worth calling out for beginners:

- **ALB cost:** up to **25 Express Mode services** can share one Application Load Balancer (host-header routing), which matters because ALBs are often the surprise line item.
- **No lock-in:** cluster, service, task definition, ALB, and logs are normal resources in your account — you can graduate to full ECS later.

---

## What went wrong — troubleshooting

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| Tasks keep restarting | Health check fails | Set path to `/api/health`, not default `/ping` |
| 502 Bad Gateway | Port mismatch | Container port must be **80** |
| Can't pull image | Execution role missing ECR access | Attach `AmazonECSTaskExecutionRolePolicy` |
| Page loads but no data | Outbound HTTPS blocked or API down | Check CloudWatch logs; test `/api/energy` directly |
| Stuck provisioning | Missing infrastructure role | Create role with `AmazonECSInfrastructureRolePolicyForExpressServices` |

**Where to look first:** CloudWatch → Log groups → your service's log group → container stdout.

Test health from your machine (after deploy):

```powershell
curl https://power-snapshot-ng.ecs.us-east-1.on.aws/api/health
```

---

## Peek under the hood

After deploy, inspect these in the console:

- **ECS** → Clusters → Express Mode cluster
- **ECS** → Task definitions
- **EC2** → Load Balancers
- **CloudWatch** → Log groups

These are real ECS resources — not a black box.

---

## Cleanup

Do this when you're done so you aren't charged for idle resources:

1. **ECS** → **Express mode** → select **power-snapshot-ng** → **Delete**
2. **ECR** → **power-snapshot-ng** → **Delete repository** (force delete if images remain)
3. Confirm the service is gone; shared ALBs may persist until all Express services using them are deleted

---

## Local development (without Docker)

```powershell
npm install
$env:PORT = "3000"
npm start
```

Open **http://localhost:3000**. Use port 3000 locally; use port **80** in the container for Express Mode.

---

## Article screenshot checklist

- [ ] App at `http://localhost:8080` after `docker run`
- [ ] ECR repo with pushed image
- [ ] Express Mode create form (port **80**, health path `/api/health`)
- [ ] Timeline during provisioning
- [ ] Live HTTPS URL with Nigeria electricity stats displayed
- [ ] ECS cluster / ALB under the hood
- [ ] Cleanup completed

---

## What's next in the series

- **Next post:** GitHub Actions → build → push ECR → deploy Express Mode on merge
- **After that:** Graduate to full ECS, or swap in the multi-service Dream Vacation app from the parent repo
