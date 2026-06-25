# NeXL On-Prem Recording Storage

This repository provides an on-premises recording storage and management portal for NXLink CCaaS (Contact Center as a Service). It allows you to automatically download, store, and manage voice recordings locally based on configurable rules.

> **Note:** Currently, this system only supports **audio file download and playback**. Support for downloading voice transcriptions and digital conversations will be added in future updates.

## Features

- **Automated Downloads**: Set up flexible rules (based on agents, call direction, duration) to automatically fetch recordings from the NXLink API and store them locally.
- **Recording Management Portal**: A modern web dashboard (built with Next.js) to view, filter, and playback voice recordings.
- **Bulk Exports**: Select multiple call records and export the audio files natively in bulk (ZIP format) or download CSV reports.
- **User Management & RBAC**: Integrated authentication and role-based access control to safely manage who can view, download, or manage API configurations.
- **Dockerized Setup**: Easily run the backend API server and frontend web application using Docker Compose.

## Architecture

The project is built as a monorepo containing:
- **`packages/web`**: Next.js frontend application (React, Tailwind CSS).
- **`packages/server`**: Node.js/Express backend server with Prisma ORM for database management.
- **`packages/shared`**: Shared TypeScript definitions and utilities.

## Getting Started

1. Clone this repository.
2. Ensure you have Docker and Docker Compose installed.
3. Configure your `.env` based on `.env.example`.
4. Run `docker compose up -d` to build and start the MySQL database, Backend server, and Web application.
5. Access the portal at `http://localhost:3008`.

## Integrations

- Requires an active NXLink CCaaS API configuration (Gateway URL, Access Key, Secret Key).
- Handles encryption/decryption out-of-the-box if enabled in the NXLink platform.

