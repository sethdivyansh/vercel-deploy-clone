# vercel-deploy-clone

## Overview
This project is a Vercel deployment clone that enables users to deploy their GitHub projects seamlessly. It is built using JavaScript, AWS services, ECS, ECR, S3, Redis, and Socket.io.

## Features
- **GitHub Integration:** Takes a GitHub repository URL and clones the project.
- **Docker-Based Deployment:** Uses AWS ECS and Docker to handle large projects efficiently, ensuring parallelism and security.
- **S3 Storage:** Builds are pushed to an S3 bucket for storage and streaming.
- **Real-Time Logs:** Deployment logs are stored in Redis and displayed in real-time using Socket.io.
- **Custom Domain:** Implements a custom reverse proxy to assign a domain to the deployed project.

## How It Works
- **API Server:** Handles RESTful API requests and manages project deployment.

- **GitHub Cloning:** The API server accepts a GitHub URL and clones the repository into a Docker container.

- **Containerized Build:** The cloned project is built inside an AWS ECS Docker container.

- **Deployment to S3:** The build is pushed to an AWS S3 bucket for hosting.

- **Real-Time Logging:** Redis stores logs, and Socket.io streams them to users.

## Installation

1. Clone the repository:

```
git clone [<repository-url>](https://github.com/sethdivyansh/vercel-deploy-clone)
cd vercel-deployment-clone
```

2. Install dependencies:
```
cd api-server
npm install
cd ..

cd build-server
npm install
cd ..

cd s3-reverse-proxy
npm install
cd ..
```

3. Configure environment variables:

- AWS credentials

- Redis connection details

4. Start Build server:

```
cd build-server
npm run dev
```

5. Start Api server:

```
cd api-server
npm run dev
```

6. Start Reverse Proxy:

```
cd s3-reverse-proxy
npm run dev
```
