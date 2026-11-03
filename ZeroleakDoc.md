# ZeroLeak: Comprehensive Project Documentation
*A Zero Trust Secure Examination Platform*

## 1. Project Overview & Completion Status
**ZeroLeak** is a highly secure, blockchain-backed examination platform designed to prevent cheating, detect anomalies, and ensure absolute cryptographic transparency in the examination process. 

**Current Completion Status:** The core architecture is **fully functional and highly advanced**. The system successfully handles the entire lifecycle of an examination from question creation to blockchain-backed auditing. The primary remaining work revolves around DevOps (Docker), AI integrations, and advanced real-time proctoring features.

---

## 2. Core Technologies Used
* **Frontend:** React.js 19, Vite, React Router, Recharts, Lucide-React
* **Backend:** Node.js, Express.js (v5)
* **Database:** MongoDB (using Mongoose for schemas and aggregation)
* **Blockchain/Ledger:** Hyperledger Fabric (via `@hyperledger/fabric-gateway`)
* **Security/Cryptography:** Bcrypt, JSON Web Tokens (JWT), Merkle Trees (SHA-256), Swagger API Documentation

---

## 3. User Roles & Workflows

### 👩‍🎓 Students
* **Authentication:** Secure login and registration.
* **Exam Portal:** Can view assigned, available, and upcoming exams.
* **Resilient Exam Taking (`TakeExam.jsx`):** 
  * **Auto-Save & Offline Tolerance:** Answers are saved locally as the student types. If the internet disconnects, progress is not lost.
  * **Background Sync:** If an exam is submitted while offline, it is queued and silently synced to the server via a heartbeat (`pingServer`) the moment connection restores.
  * **Anti-Cheating UI:** The UI tracks warnings and enforces strict rules.
* **Results:** Can view their graded score immediately upon submission (if permitted by admin).

### 👨‍🏫 Professors
* **Question Bank Management:** Can create individual questions and group them into "Batches".
* **Batch Operations:** Can bulk-import questions into batches, edit, and delete them.
* **Submission for Review:** Professors submit batches to the Admin for approval before they can be used in an active exam.

### 🛡️ Administrators (Admins)
* **User Management:** Can bulk import, delete, block, and unblock students and professors.
* **Batch Review:** Can review question batches submitted by professors and approve or reject them.
* **Exam Lifecycle:** Responsible for creating the actual Exam instances, setting timers, and linking approved batches.
* **Security Overrides:** Can manually authorize fresh attempts for students whose exams were auto-terminated due to cheating.
* **Results Release:** Admins control when exam results are published to students.

### 🕵️ Auditors
* **Read-Only Access:** Auditors have specialized read-only access to monitor the integrity of the platform.
* **Anomaly Detection:** Can view dashboard metrics, scan for anomalies, and review system logs to ensure no Admin or Professor tampered with the data.

---

## 4. Key Advanced Functionalities Implemented

### A. Anti-Cheating & Telemetry Engine
* **Incident Logging:** Tracks abnormal behaviors (e.g., switching tabs).
* **3-Strike Rule:** If a student exceeds the maximum allowed warnings, their exam is instantly and permanently **Terminated**.
* **Telemetry Ping:** A background heartbeat runs every 5 seconds, sending the student's status to the server to ensure they are actively taking the test and not bypassing the UI restrictions.

### B. Blockchain Auditing (Zero-Trust)
* **Cryptographic Commitments:** The backend utilizes **Merkle Trees** to cryptographically hash questions, batches, and exam results.
* **Immutable Ledger:** These hashes are periodically committed to a **Hyperledger Fabric** blockchain using a background worker (`AnchorWorker`).
* **Data Integrity Verification:** If an Admin attempts to alter a student's score in MongoDB, the Auditor can verify the data against the Blockchain anchor hash and immediately detect the tampering.

### C. Swagger API Documentation
* **Interactive Docs:** All endpoints (Student, Professor, Admin, Auditor, Anti-cheating, Blockchain) are fully documented using OpenAPI/Swagger.
* **Testing UI:** Available at `/api-docs`, allowing developers to test requests visually.

---

## 5. What's Next? (Roadmap from `work.txt`)
Based on the current architecture, the project is ready for the following advanced enhancements:

1. **Add Docker Setup (Vikhyat):** Writing `docker-compose.yml` to containerize the Frontend, Backend, and MongoDB for 1-click deployment.
2. **Proctoring/Real-Time Monitoring (Himanshu):** Implementing WebSockets (`Socket.io`) so the Admin/Professor can see live incidents on a dashboard, plus advanced browser lockdown APIs.
3. **AI Integration (Ashish):** Using `MediaPipe` or `TensorFlow.js` in the browser to track the student's face/gaze to ensure they aren't looking away or having someone else take the test.
4. **Redis (Yashwant):** Implementing a caching layer to handle massive traffic spikes when hundreds of students start an exam at the exact same second.
5. **End-to-End Encryption:** Encrypting the exam payload over the wire so it cannot be scraped from the browser's Network tab before the exam starts.
6. **Notes in CBT:** Adding a digital sketchpad/whiteboard for students to do "rough work" and syncing those drawings to the server for professors to review.

