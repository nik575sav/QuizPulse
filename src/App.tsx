/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth";

import AuthPage from "./pages/AuthPage";
import Dashboard from "./pages/Dashboard";
import QuizEditor from "./pages/QuizEditor";
import QuizRoom from "./pages/QuizRoom";

function ProtectedRoute({ children, role }: { children: ReactNode, role?: 'organizer' | 'participant' }) {
  const user = useAuthStore(state => state.user);
  const mode = useAuthStore(state => state.mode);
  if (!user) return <Navigate to="/auth" />;
  if (role && mode !== role) {
    return <Navigate to="/" />; // redirect to home if wrong mode/role
  }
  return children;
}

export default function App() {
  const user = useAuthStore(state => state.user);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth" element={!user ? <AuthPage /> : <Navigate to="/" />} />
        
        {/* Organizer Routes */}
        <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/create-quiz" element={<ProtectedRoute role="organizer"><QuizEditor /></ProtectedRoute>} />
        
        {/* Common Quiz Routes */}
        <Route path="/room/:code" element={<ProtectedRoute><QuizRoom /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}
