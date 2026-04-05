# Node.js + GCP Pub/Sub Order Publisher

## Project Introduction

This project is a **Order Creation Event Publisher** backend built with Node.js and the GCP Pub/Sub Library. It continuously generates dummy grocery ecommerce orders and publishes them to a GCP Pub/Sub topic.

The application is designed to be deployed on Google Kubernetes Engine (GKE) and adheres to 12-factor app principles, including configuration via environment variables, structured logging, and stateless processes.

The order events published by this application are intended to be consumed by a separate subscriber application, which would then persist them into a database like PostgreSQL.

## Core Features

- **Batch Publishing**: The application leverages the built-in batching mechanism of the Google Cloud Pub/Sub client library. This improves efficiency and reduces costs by bundling multiple messages into a single publish request. Batching settings (`maxMessages`, `maxMilliseconds`) are configured on the topic object.

- **Robust Error Handling**: Includes `try...catch` blocks for publish operations, global handlers for `uncaughtException` and `unhandledRejection` to prevent crashes, and a graceful shutdown mechanism to ensure all buffered messages are sent before the application exits.

- **Structured Logging**: Uses the `winston` library to produce structured JSON logs. This format is ideal for consumption by cloud-native logging and monitoring systems like Google Cloud's operations suite (formerly Stackdriver).

- **12-Factor App Principles**:
  - **Config:** Configuration is strictly separated from code and managed through environment variables, supplied by Kubernetes ConfigMaps.
  - **Dependencies:** Explicitly declared and isolated via `package.json`.
  - **Logs:** Treats logs as event streams, writing structured output to `stdout`.
  - **Disposability:** The application can be started or stopped gracefully, with a `SIGTERM` handler to flush messages before exiting.

## Project Structure

```
.
├── k8s/                          # Kubernetes deployment manifests
│   ├── configmap.yaml            # ConfigMap for environment variables
│   ├── deployment.yaml           # Deployment for the application
│   └── service-account.yaml      # KSA for Workload Identity
├── .dockerignore                 # Files to ignore in Docker build context
├── .gitignore                    # Files to ignore for git
├── cloudbuild.yaml               # CI/CD pipeline for Google Cloud Build
├── Dockerfile                    # Multi-stage Dockerfile for containerization
├── GEMINI.md                     # This file
├── index.js                      # Main application logic
└── package.json                  # Node.js project metadata and dependencies
```

## Local Development

### Prerequisites

- Node.js (v18 or later)
- `gcloud` CLI authenticated with a GCP account

### Setup

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Set Up Environment Variables**:
    Create a `.env` file in the root directory (this file is git-ignored). You will need to have a GCP project and a Pub/Sub topic created.
    ```env
    # Your Google Cloud Project ID
    GCP_PROJECT_ID="your-gcp-project-id"

    # The ID of your Pub/Sub topic
    PUBSUB_TOPIC_ID="your-pubsub-topic-id"

    # Optional: Interval in ms to publish messages
    PUBLISH_INTERVAL_MS="2000"
    ```
    *Note: For local development, you also need to authenticate the client library. Run `gcloud auth application-default login`.*

3.  **Run the Application**:
    ```bash
    npm start
    ```
    You should see logs in your console indicating that messages are being published.

## Build and Deployment

This application is designed to be deployed on GKE using Google Cloud Build for CI/CD.

### 1. Docker Image

The `Dockerfile` uses a multi-stage build to create a lightweight and secure production image. It installs dependencies, creates a non-root user, and copies only the necessary application files.

### 2. GKE Deployment Manifests (`/k8s`)

-   **`service-account.yaml`**: Defines a Kubernetes Service Account (KSA). It is annotated to use GKE Workload Identity, which is the recommended secure way to grant pods access to GCP services without managing service account keys. **You must update this file** with your Google Service Account (GSA) details.
-   **`configmap.yaml`**: Externalizes configuration like the Pub/Sub topic ID.
-   **`deployment.yaml`**: Defines the application deployment, including resource requests/limits, and references the ConfigMap and Service Account.

### 3. Cloud Build CI/CD Pipeline (`cloudbuild.yaml`)

The `cloudbuild.yaml` file defines a pipeline that:
1.  Builds the Docker image.
2.  Pushes the image to Google Artifact Registry.
3.  Updates the `deployment.yaml` with the new image tag and project ID.
4.  Applies the Kubernetes manifests to deploy the application to your GKE cluster.

To use this pipeline, you will need to create a Cloud Build trigger and provide substitution variables for your GKE cluster and Artifact Registry repository.

---

This project is a **Node.js** backend application using the **GCP PubSub Library**
framework. It focuses on building robust, scalable, and secure publisher
logic and adhering to 12 factor app principles.
