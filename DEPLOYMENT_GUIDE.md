# 🚀 Deployment Guide: Dockerfile & GitHub Actions Explained

This guide explains every line of our Dockerfile and GitHub Actions workflow in simple, clear language.

---

## 📦 Dockerfile Explanation

Our Dockerfile creates a container image that packages our Node.js application for deployment.

### Line-by-Line Breakdown:

```dockerfile
# Use Node.js LTS version
FROM node:20-alpine
```

**What it does:** Start with a base image that has Node.js version 20 installed

- `node:20-alpine` = Node.js 20 + Alpine Linux (lightweight, secure)
- Alpine Linux makes our image smaller and faster

```dockerfile
# Set working directory
WORKDIR /app
```

**What it does:** Create and switch to `/app` folder inside the container

- All future commands will run from this directory
- Like doing `cd /app` on your computer

```dockerfile
# Copy package files
COPY package*.json ./
```

**What it does:** Copy `package.json` and `package-lock.json` to the container

- `package*.json` matches both files
- `./` means "copy to current directory" (which is `/app`)
- We copy these first for Docker layer caching optimization

```dockerfile
# Install dependencies
RUN npm ci --only=production
```

**What it does:** Install only the packages needed for production

- `npm ci` = faster, reliable install (like `npm install` but better for production)
- `--only=production` = skip development tools (ESLint, TypeScript, etc.)
- This makes our final image smaller

```dockerfile
# Copy source code
COPY . .
```

**What it does:** Copy all our project files into the container

- First `.` = everything from our project folder
- Second `.` = copy to current directory (`/app`)
- `.dockerignore` excludes files we don't want (like `node_modules`)

```dockerfile
# Build TypeScript
RUN npm run build
```

**What it does:** Compile our TypeScript code to JavaScript

- Creates the `dist/` folder with compiled JavaScript
- This is what actually runs in production

```dockerfile
# Expose port
EXPOSE 3000
```

**What it does:** Tell Docker our app listens on port 3000

- This is documentation - doesn't actually open the port
- Helps other developers know which port to use

```dockerfile
# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
```

**What it does:** Create a new user called `nodejs`

- **Security best practice:** Don't run apps as root user
- `-g 1001` = group ID, `-u 1001` = user ID
- `-S` = system user (no password needed)

```dockerfile
# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs
```

**What it does:** Give the `nodejs` user control of our app files

- `chown -R` = change ownership recursively (all files and folders)
- `USER nodejs` = switch to run as this user from now on

```dockerfile
# Start the application
CMD ["npm", "start"]
```

**What it does:** Define the default command when container starts

- Runs `npm start` which executes `node dist/index.js`
- This starts our Express server

---

## ⚙️ GitHub Actions Workflow Explanation

Our workflow automatically deploys code when we push to specific branches.

### Workflow Trigger:

```yaml
name: Deploy to AWS App Runner

on:
  push:
    branches:
      - dev
      - staging
      - main
```

**What it does:** Start this workflow when code is pushed to these branches

- `dev` → deploys to Development environment
- `staging` → deploys to Staging environment
- `main` → deploys to Production environment

### Environment Variables:

```yaml
env:
  AWS_REGION: us-east-1
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.us-east-1.amazonaws.com
  ECR_REPOSITORY: aws-ci-cd-demo-backend
```

**What it does:** Set up variables used throughout the workflow

- `AWS_REGION` = where our AWS resources are located
- `ECR_REGISTRY` = address of our Docker image storage (uses secret AWS account ID)
- `ECR_REPOSITORY` = name of our Docker image repository

### Job Configuration:

```yaml
jobs:
  deploy:
    name: Deploy
    runs-on: ubuntu-latest
    environment: ${{ github.ref_name }}
```

**What it does:** Define a job that runs on Ubuntu virtual machine

- `environment: ${{ github.ref_name }}` = use branch name as environment name
- This enables environment-specific secrets and protection rules

### Workflow Steps:

#### Step 1: Get the Code

```yaml
- name: Checkout
  uses: actions/checkout@v4
```

**What it does:** Download our project code to the virtual machine

- Like doing `git clone` of our repository

#### Step 2: Setup Node.js

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
```

**What it does:** Install Node.js version 20 and enable npm caching

- `cache: 'npm'` = speed up builds by caching downloaded packages

#### Step 3: Install Dependencies

```yaml
- name: Install dependencies
  run: npm ci
```

**What it does:** Install all packages (including dev dependencies for building)

- We need dev dependencies here to compile TypeScript

#### Step 4: Build Project

```yaml
- name: Build project
  run: npm run build
```

**What it does:** Compile TypeScript to JavaScript

- Creates the `dist/` folder that gets copied to Docker image

#### Step 5: Setup AWS Access

```yaml
- name: Configure AWS credentials
  uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ env.AWS_REGION }}
```

**What it does:** Log into AWS using stored secrets

- Secrets are stored securely in GitHub repository settings
- This gives us permission to push images and deploy

#### Step 6: Login to Docker Registry

```yaml
- name: Login to Amazon ECR
  id: login-ecr
  uses: aws-actions/amazon-ecr-login@v2
```

**What it does:** Log into Amazon ECR (Docker image storage)

- ECR = Elastic Container Registry (AWS's Docker Hub)
- `id: login-ecr` = save outputs for use in next steps

#### Step 7: Build and Push Docker Image

```yaml
- name: Build, tag, and push image to Amazon ECR
  id: build-image
  env:
    ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
    IMAGE_TAG: ${{ github.ref_name }}-${{ github.sha }}
  run: |
    docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
    docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
    echo "image=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG" >> $GITHUB_OUTPUT
```

**What it does:** Create Docker image and upload it to AWS

- `IMAGE_TAG` = branch name + commit hash (e.g., `dev-abc123`)
- `docker build` = use our Dockerfile to create the image
- `docker push` = upload image to ECR
- Image gets a unique tag so we can track versions

#### Step 8-10: Deploy to Different Environments

```yaml
- name: Deploy to App Runner - Dev
  if: github.ref_name == 'dev'
  run: |
    aws apprunner start-deployment \
      --service-arn ${{ secrets.APP_RUNNER_SERVICE_ARN_DEV }} \
      --region ${{ env.AWS_REGION }}
```

**What it does:** Deploy to the correct environment based on branch

- `if: github.ref_name == 'dev'` = only run this step for dev branch
- `aws apprunner start-deployment` = tell AWS to update the service with new image
- Each environment has its own App Runner service ARN (stored as secrets)

---

## 🎯 Complete Flow Summary

1. **Developer pushes code** to `dev`, `staging`, or `main` branch
2. **GitHub Actions starts** and creates a fresh Ubuntu virtual machine
3. **Code gets downloaded** and Node.js gets installed
4. **Dependencies are installed** and TypeScript is compiled
5. **AWS credentials are configured** for deployment access
6. **Docker image is built** using our Dockerfile
7. **Image is pushed** to Amazon ECR with a unique tag
8. **App Runner is notified** to deploy the new image to the correct environment
9. **Your API is live** and accessible on the internet!

## 🔒 Security Features

- **Non-root user** in Docker container
- **Production-only dependencies** in final image
- **Encrypted secrets** for AWS credentials
- **Environment isolation** between dev/staging/production
- **Unique image tags** for version tracking

---

## 📋 Docker Commands Reference

Here are the key Docker commands used in our Dockerfile and what they do:

### Core Docker Commands:

#### `FROM node:20-alpine`

- **Purpose:** Sets the base image for our container
- **Syntax:** `FROM <image>:<tag>`
- **Example:** `FROM ubuntu:20.04`, `FROM python:3.9`
- **Why Alpine:** Smaller size (~5MB vs ~900MB for full Ubuntu)

#### `WORKDIR /app`

- **Purpose:** Sets the working directory inside container
- **Syntax:** `WORKDIR <path>`
- **Effect:** All subsequent commands run from this directory
- **Alternative:** Using `RUN cd /app` (but WORKDIR is better practice)

#### `COPY package*.json ./`

- **Purpose:** Copy files from host to container
- **Syntax:** `COPY <source> <destination>`
- **Wildcard:** `package*.json` matches `package.json` and `package-lock.json`
- **Optimization:** Copy package files first for better layer caching

#### `RUN npm ci --only=production`

- **Purpose:** Execute commands during image build
- **Syntax:** `RUN <command>`
- **npm ci vs npm install:**
  - `npm ci` is faster and more reliable for production
  - Uses `package-lock.json` for exact versions
  - `--only=production` skips devDependencies

#### `COPY . .`

- **Purpose:** Copy all project files to container
- **First `.`:** Source (current directory on host)
- **Second `.`:** Destination (current WORKDIR in container)
- **Respects:** `.dockerignore` file exclusions

#### `EXPOSE 3000`

- **Purpose:** Document which port the app uses
- **Syntax:** `EXPOSE <port>`
- **Note:** Doesn't actually open port (documentation only)
- **Runtime:** Use `docker run -p 3000:3000` to map ports

#### `RUN addgroup -g 1001 -S nodejs`

- **Purpose:** Create a system group
- **Flags:**
  - `-g 1001`: Set group ID to 1001
  - `-S`: Create system group (no password)
- **Security:** Avoid running as root user

#### `RUN adduser -S nodejs -u 1001`

- **Purpose:** Create a system user
- **Flags:**
  - `-S`: System user (no password, no home directory)
  - `-u 1001`: Set user ID to 1001
- **Best Practice:** Match user/group IDs for consistency

#### `RUN chown -R nodejs:nodejs /app`

- **Purpose:** Change file ownership
- **Syntax:** `chown <user>:<group> <path>`
- **Flag:** `-R` = recursive (all files and subdirectories)
- **Security:** Give app user control of app files

#### `USER nodejs`

- **Purpose:** Switch to non-root user
- **Syntax:** `USER <username>`
- **Effect:** All subsequent commands run as this user
- **Security:** Prevents privilege escalation attacks

#### `CMD ["npm", "start"]`

- **Purpose:** Default command when container starts
- **Syntax:** `CMD ["executable", "param1", "param2"]`
- **vs RUN:** CMD runs when container starts, RUN runs during build
- **Override:** Can be overridden with `docker run <image> <command>`

---

## ⚙️ GitHub Actions Commands Reference

Key commands and concepts used in our workflow:

### Workflow Commands:

#### `uses: actions/checkout@v4`

- **Purpose:** Download repository code to runner
- **Version:** `@v4` is the latest stable version
- **What it does:** Like running `git clone` of your repository
- **Files:** Makes all your project files available to workflow

#### `uses: actions/setup-node@v4`

- **Purpose:** Install and configure Node.js
- **Parameters:**
  - `node-version: '20'`: Install Node.js version 20
  - `cache: 'npm'`: Cache npm packages for faster builds
- **Effect:** Makes `node` and `npm` commands available

#### `run: npm ci`

- **Purpose:** Install dependencies in CI environment
- **vs npm install:** Faster, uses lockfile, fails if inconsistent
- **Clean install:** Removes `node_modules` first
- **Reliable:** Perfect for automated environments

#### `run: npm run build`

- **Purpose:** Execute build script from package.json
- **What it does:** Compiles TypeScript to JavaScript
- **Output:** Creates `dist/` folder with compiled code
- **Required:** Production deployment needs compiled JavaScript

#### `uses: aws-actions/configure-aws-credentials@v4`

- **Purpose:** Authenticate with AWS services
- **Required secrets:**
  - `AWS_ACCESS_KEY_ID`: Your AWS access key
  - `AWS_SECRET_ACCESS_KEY`: Your AWS secret key
- **Effect:** Enables all AWS CLI commands

#### `uses: aws-actions/amazon-ecr-login@v2`

- **Purpose:** Login to Amazon Elastic Container Registry
- **What it does:** Authenticates Docker to push images to ECR
- **Output:** Registry URL for Docker commands
- **Required:** Before pushing Docker images

#### `docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .`

- **Purpose:** Build Docker image from Dockerfile
- **Flags:**
  - `-t`: Tag the image with a name
  - `.`: Use current directory as build context
- **Tag format:** `registry/repository:tag`
- **Example:** `123456789.dkr.ecr.us-east-1.amazonaws.com/my-app:main-abc123`

#### `docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG`

- **Purpose:** Upload Docker image to registry
- **Requirement:** Must be logged in to registry first
- **Result:** Image available for deployment
- **Versioning:** Each push gets unique tag

#### `aws apprunner start-deployment`

- **Purpose:** Trigger new deployment in App Runner
- **Parameters:**
  - `--service-arn`: Unique identifier for App Runner service
  - `--region`: AWS region where service is located
- **Result:** App Runner pulls latest image and deploys

---

## 🔐 GitHub Secrets Management

Secrets store sensitive information securely in your GitHub repository.

### How to Add Secrets:

#### Step 1: Navigate to Repository Settings

1. Go to your GitHub repository
2. Click **"Settings"** tab (next to Code, Issues, Pull requests)
3. In left sidebar, click **"Secrets and variables"**
4. Click **"Actions"**

#### Step 2: Add Repository Secrets

Click **"New repository secret"** for each of these:

```bash
# Required AWS Secrets:
AWS_ACCESS_KEY_ID          # Your AWS access key ID
AWS_SECRET_ACCESS_KEY      # Your AWS secret access key
AWS_ACCOUNT_ID            # Your 12-digit AWS account number

# App Runner Service ARNs (get these after creating services):
APP_RUNNER_SERVICE_ARN_DEV      # Dev environment service ARN
APP_RUNNER_SERVICE_ARN_STAGING  # Staging environment service ARN
APP_RUNNER_SERVICE_ARN_PROD     # Production environment service ARN
```

### Getting AWS Credentials:

#### Option 1: IAM User (Recommended for CI/CD)

1. **AWS Console** → **IAM** → **Users** → **Create user**
2. **Username:** `github-actions-user`
3. **Permissions:** Attach policies:
   - `AmazonEC2ContainerRegistryFullAccess`
   - `AppRunnerFullAccess`
4. **Access keys** → **Create access key** → **Third-party service**
5. **Copy:** Access Key ID and Secret Access Key

#### Option 2: AWS CLI (If you have AWS CLI configured)

```bash
# View your credentials (don't share these!)
cat ~/.aws/credentials

# Get your AWS account ID
aws sts get-caller-identity --query Account --output text
```

### Getting App Runner Service ARNs:

#### After creating App Runner services:

```bash
# List all App Runner services
aws apprunner list-services --region us-east-1

# Get specific service details
aws apprunner describe-service --service-arn <service-arn> --region us-east-1
```

#### ARN Format:

```
arn:aws:apprunner:us-east-1:123456789012:service/my-app-dev/abcdef123456
```

### Environment-Specific Secrets:

#### For Advanced Setup (Optional):

You can create **environment-specific secrets**:

1. **Repository Settings** → **Environments**
2. **Create environments:** `dev`, `staging`, `main`
3. **Add environment-specific secrets** to each environment
4. **Benefits:**
   - Different AWS accounts per environment
   - Environment protection rules
   - Approval workflows for production

### Secret Usage in Workflow:

```yaml
# Access secrets in workflow
${{ secrets.SECRET_NAME }}

# Example
aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
```

### Security Best Practices:

#### ✅ Do:

- **Rotate secrets** regularly (every 90 days)
- **Use least privilege** principle for IAM permissions
- **Create separate IAM users** for different environments
- **Monitor secret usage** in AWS CloudTrail
- **Use environment protection** for production deployments

#### ❌ Don't:

- **Never commit secrets** to code
- **Don't use personal AWS credentials** for CI/CD
- **Don't share secrets** in chat/email
- **Don't reuse production secrets** for development
- **Don't give excessive permissions** to CI/CD users

### Troubleshooting Secrets:

#### Common Issues:

1. **"Secrets not found" error:**
   - Check secret names match exactly (case-sensitive)
   - Verify secrets are added to correct repository
   - Ensure workflow has access to secrets

2. **AWS authentication failed:**
   - Verify AWS credentials are correct
   - Check IAM user has required permissions
   - Confirm AWS region is correct

3. **App Runner deployment failed:**
   - Verify service ARNs are correct
   - Check App Runner service exists in specified region
   - Ensure IAM user has App Runner permissions

---

This setup gives you a professional, secure, and scalable deployment pipeline! 🚀
