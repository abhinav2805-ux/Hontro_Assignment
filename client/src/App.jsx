import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Login from './pages/Login';
import Register from './pages/Register';
import './App.css';

// Temporary placeholders – we'll replace with real components later
const Dashboard = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Dashboard (Coming Soon)</h1>
  </div>
);

const Board = () => (
  <div className="p-8">
    <h1 className="text-2xl font-bold">Board View (Coming Soon)</h1>
  </div>
);

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-center" />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/board/:id" element={<Board />} />
        <Route path="/" element={<Navigate to="/login" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;

