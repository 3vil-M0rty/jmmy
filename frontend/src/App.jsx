import { RouterProvider } from 'react-router-dom';
import { Suspense } from 'react';
import router from './router/index.jsx';

export default function App() {
  return (
    <Suspense fallback={<div className="loading-screen">Loading…</div>}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
