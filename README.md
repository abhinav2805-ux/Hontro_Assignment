# TaskManager – Real‑Time Task Collaboration Platform

A lightweight Trello/Notion‑style board built for **real‑time multi‑user collaboration**.

Users can:

- Sign up / log in.
- Create boards with lists.
- Create, update, delete, and drag tasks across lists.
- Assign users to tasks and highlight tasks assigned to them.
- See **live updates** (via WebSockets) from other users.
- View an activity history log.
- Search and paginate tasks.

---

## 1. Tech Stack

- **Frontend**: React + Vite, React Router, Tailwind CSS, `@hello-pangea/dnd`, Axios, React Hot Toast, Socket.IO client.
- **Backend**: Node.js, Express, MongoDB (Mongoose), Socket.IO.
- **Auth**: JWT-based authentication.
- **Build/Tooling**: npm, Vite, nodemon (dev).

---

## 2. Project Structure

```text
Assignment/
  client/           # React SPA (Vite)
    src/
      pages/        # Login, Register, Dashboard, Board
      components/   # Task card component, shared UI
      utils/api.js  # Axios instance (uses VITE_API_BASE_URL)
    .env.example
  server/
    models/         # Mongoose models (User, Board, List, Task, Activity, ActivityLog)
    routes/         # REST routes (auth, boards, lists, tasks, activity, activities)
    middleware/     # auth.js (JWT verification)
    server.js       # Express + Socket.IO bootstrap
    .env.example
  README.md
```

---

## 3. Setup & Running Locally

### 3.1 Prerequisites

- Node.js (LTS)
- npm
- MongoDB running locally or a MongoDB URI (e.g. Atlas)

### 3.2 Backend (`server`)

1. Install dependencies:

   ```bash
   cd server
   npm install
   ```

2. Create `.env` from the example:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env` as needed:

   ```env
   PORT=5000
   NODE_ENV=development

   MONGO_URI=mongodb://localhost:27017/taskmanager
   JWT_SECRET=replace-with-strong-secret

   # Your frontend origin (for CORS)
   CLIENT_ORIGIN=http://localhost:5173
   ```

4. Start the backend:

   ```bash
   npm run dev    # or: npm start
   ```

   API will be available at `http://localhost:5000/api`.

### 3.3 Frontend (`client`)

1. Install dependencies:

   ```bash
   cd ../client
   npm install
   ```

2. Create `.env` from the example:

   ```bash
   cp .env.example .env
   ```

3. Edit `.env`:

   ```env
   VITE_API_BASE_URL=http://localhost:5000/api
   VITE_SOCKET_URL=http://localhost:5000
   ```

4. Start the frontend:

   ```bash
   npm run dev
   ```

   App will be available at `http://localhost:5173`.

---

## 4. Environment Configuration for Deployment

For deployment, you only need to adjust `.env` values:

### Backend (`server/.env`)

- `MONGO_URI` – production MongoDB URI.
- `JWT_SECRET` – long random secret.
- `CLIENT_ORIGIN` – your deployed frontend URL, e.g.:

  ```env
  CLIENT_ORIGIN=https://my-taskmanager-frontend.com
  ```

### Frontend (`client/.env`)

- `VITE_API_BASE_URL` – deployed backend API (must include `/api`).
- `VITE_SOCKET_URL` – same backend origin, **without** `/api`.

Example:

```env
VITE_API_BASE_URL=https://my-taskmanager-backend.com/api
VITE_SOCKET_URL=https://my-taskmanager-backend.com
```

Build the frontend for production:

```bash
cd client
npm run build
```

Serve `client/dist` with your hosting of choice or behind the Node server (e.g. via reverse proxy).

---

## 5. Core Features

### 5.1 Authentication

- Endpoints:
  - `POST /api/auth/signup` – create user.
  - `POST /api/auth/login` – authenticate, returns `{ token, user }`.
  - `GET /api/auth/me` – current user (JWT required).
- JWT is returned to the client and stored in `localStorage` (`token` + `user`).
- Axios interceptor automatically attaches `Authorization: Bearer <token>` to each request.

### 5.2 Boards & Lists

- A **Board** belongs to an owner (`userId`) and can include collaborators (`collaborators`).
- Lists belong to a board and are ordered by `position`.

**Endpoints:**

- `GET /api/boards` – all boards user can see (owner or collaborator).
- `POST /api/boards` – create board.
- `GET /api/boards/:id` – board + lists + tasks (used by API; UI loads lists/tasks via separate endpoints).
- `GET /api/lists?boardId=<id>` – lists for a board.
- `POST /api/lists` – create list.

### 5.3 Tasks (CRUD + Drag & Drop + Assign)

**Model**

- `Task`:
  - `title`, `description`
  - `boardId`, `listId`
  - `priority` (`Low` | `Medium` | `High`)
  - `deadline`
  - `position`
  - `assignees: [User._id]`
- Text index on `title` + `description` supports search.

**Endpoints (main ones):**

- `POST /api/tasks` – create task.
- `GET /api/tasks?boardId=<id>&q=<search>&page=<page>&limit=<limit>` – get tasks for a board, with:
  - Full‑text search (`q`).
  - Pagination (`page`, `limit`).
  - Response: `{ data, page, limit, total, totalPages }`.
- `PUT /api/tasks/:id` – update:
  - Title/description/priority/deadline.
  - Move between lists + update `position`.
  - `assigneeName` – username lookup to push into `assignees`.
- `DELETE /api/tasks/:id` – delete.

**Assignment logic**

- Frontend `Task` card has a `+ User` button.
- User types a username; frontend sends:

  ```json
  { "assigneeName": "abhinav" }
  ```

- Backend:
  - Finds `User` by `username`.
  - Adds the user’s `_id` to `task.assignees` (if not already there).
  - Adds that user to `Board.collaborators` so they can see the board.

**Highlighting assigned tasks**

- In the Board view, each `Task` receives `currentUserId` from `localStorage.user`.
- If `currentUserId` is in `task.assignees`, the card uses a **green glowing border**.

### 5.4 Real‑Time Sync (Socket.IO)

- Server attaches Socket.IO to the HTTP server.
- Each Board is a **room**; clients emit `joinBoard(boardId)` when the board page mounts.
- Events:
  - `taskCreated`
  - `taskUpdated` / `task_updated`
  - `task_moved`
  - `taskDeleted`
  - `listCreated`
  - `activityLog` (for the sidebar)

**Backend**

- After create/update/delete list/task, server emits to the board’s room.
- For updates, server emits the **full updated task**, with assignees populated.

**Frontend**

- `Board.jsx`:
  - Subscribes to the events above.
  - `taskCreated`: refetches tasks (keeps pagination metadata in sync).
  - `taskUpdated`/`task_moved`: updates `tasksByList` in memory.
  - `taskDeleted`: removes from `tasksByList`.
  - `activityLog`: prepends to local activity list.

Result: moving/creating/updating tasks in one browser reflects **instantly** in all browsers on the same board, passing the “two‑window” test.

### 5.5 Activity History

- `ActivityLog` model – structured logs for auditing.
- `Activity` model – user‑friendly history entries (`username`, `action`, `boardId`).

**Endpoints:**

- `GET /api/activity?boardId=<id>` – paginated structured logs for the current user.
- `GET /api/activities/:boardId` – last 20 human‑readable activities for a board.

**UI**

- Board header includes an **Activity Log** toggle.
- Sidebar shows a scrollable list with `username`, description and timestamp.
- New actions (create, move, update, assign) show up live via `activityLog` socket event.

### 5.6 Search & Pagination

- Search input in `Board` header:
  - Filters by task `title` / `description` via backend text search.
  - Changing search resets to page `1`.
- Pagination controls:
  - `Page X of Y`, with Prev/Next buttons.
  - Frontend passes `page` and `limit` to `/api/tasks`.
- Drag‑and‑drop is disabled when search is active to avoid reordering a filtered subset.

---

## 6. Frontend Architecture

- **Routing** (`App.jsx`):
  - `/login`, `/register`
  - `/dashboard` – protected
  - `/board/:id` – protected
- **ProtectedRoute** wrapper checks for `token` in `localStorage`.
- **Pages**:
  - `Login` / `Register` – sci‑fi auth consoles reusing the same gradient/dark theme.
  - `Dashboard` – list/creation of boards in a glassmorphism panel grid.
  - `Board` – main drag‑and‑drop canvas, search, pagination, real‑time activity sidebar.

State within `Board`:

- `lists` – fetched from `/api/lists?boardId=...`
- `tasksByList` – tasks grouped by `listId`
- `newTaskTitles`, `newTaskPriorities`
- `activities` – activity sidebar
- `searchQuery`, `page`, `totalPages`, `isDragging`

Drag‑and‑drop:

- `DragDropContext` + `Droppable` (list) + `Draggable` (`Task` component).
- On `onDragEnd`:
  - Build new `tasksByList`.
  - Recompute positions.
  - Send batched `PUT /api/tasks/:id` updates.
  - Optimistically update UI; if API fails, refetch from backend.

---

## 7. Backend Architecture

- `server.js`:
  - Connects to MongoDB.
  - Sets up Express middlewares (CORS, JSON body).
  - Mounts routes under `/api/...`.
  - Creates HTTP server + Socket.IO with CORS restricted by `CLIENT_ORIGIN`.
  - Injects `io` into `req` for routes to emit events.

- `middleware/auth.js`:
  - Verifies JWT, loads user, attaches `req.user` / `req.userId`.

- **Routes**:
  - `auth.js` – signup, login, `me`.
  - `boards.js` – CRUD for boards; owner vs collaborator access.
  - `lists.js` – CRUD for lists (per board).
  - `tasks.js` – all task logic (create, search, pagination, update, assign, delete) + activity and socket emits.
  - `activity.js` – structured logs.
  - `activities.js` – human‑readable history.

---

## 8. Database Schema (Summary)

- **User**
  - `username` (unique), `email` (unique), `password` (hashed).

- **Board**
  - `title`
  - `userId` – owner
  - `collaborators: [User._id]`

- **List**
  - `title`
  - `boardId`
  - `position`

- **Task**
  - `title`, `description`
  - `boardId`, `listId`
  - `priority`, `deadline`
  - `position`
  - `assignees: [User._id]`
  - Text index on `title` + `description`.

- **ActivityLog**
  - `userId`, `boardId`, `listId`, `taskId`
  - `action` (enum‑like string)
  - `details`
  - Timestamps.

- **Activity**
  - `userId`, `username`, `action`, `boardId`
  - Timestamps.

---

## 9. Testing (Basic Coverage – What Could Be Added)

(Current project does not include automated tests, but it is structured to support them.)

Examples of recommended tests:

- Backend (Jest or similar):
  - `auth` route tests for signup/login.
  - `tasks` route tests for search & pagination shape.
- Frontend (React Testing Library):
  - `Board` page: renders lists and tasks grouped correctly.
  - `Task` component: shows assigned chips and green glow for current user.

---

## 10. Assumptions & Trade‑offs

- Assignment is **username‑based**:
  - Tasks are assigned by entering the exact `username` string.
  - No user search/autocomplete UI (kept simple for scope).
- A collaborator can see all lists/tasks on a board, not only the tasks assigned to them (this better fits a Kanban board mental model).
- Drag‑and‑drop is disabled when search is active to avoid reordering a filtered subset.
- Board owner remains the only one who can delete the board; collaborators can move and edit tasks.

---

## 11. Demo Credentials (Example)

You can pre‑create some users (via signup or seed) and list them here:

```text
Owner:
  email: gunjan@example.com
  password: gunjan123

Collaborator:
  email: abhinav@example.com
  password: abhinav123
```

Use these to demonstrate the **two‑window real‑time test**:

1. Log in as Gunjan in one browser, create a board, lists, tasks.
2. Assign some tasks to user `abhinav`.
3. Log in as Abhinav in another browser / incognito:
   - See the shared board on the dashboard.
   - Open it and watch tasks update live as Gunjan moves or edits them.
   - Tasks assigned to Abhinav are highlighted with a green glowing border.

---

## 12. Real‑Time Sync Strategy & Scalability (High‑Level)

- One Socket.IO connection per client.
- A room per board (`boardId`) so only relevant clients receive events.
- Emissions are **event‑level** (per task/list change), not full board refreshes, keeping payloads small.
- For scalability, this pattern can be extended by:
  - Running Socket.IO behind a message broker (e.g. Redis adapter).
  - Sharding rooms by board id.
  - Using indexes on `Task` and `Activity` fields used for queries.

---

This README, together with the codebase, should satisfy the assignment’s **functional requirements, technical requirements, and documentation deliverables**, and is ready for submission.

