import { createBrowserRouter } from 'react-router-dom';
import Layout from '../components/Layout.jsx';
import { TransitionProvider } from '../components/TransitionContext.jsx';
import HomePage from '../pages/HomePage.jsx';
import AboutPage from '../pages/AboutPage.jsx';
import UsersPage from '../pages/UsersPage.jsx';
import NotFoundPage from '../pages/NotFoundPage.jsx';

const router = createBrowserRouter([
  
  {
    path: '/',
    element: (
      <TransitionProvider>
        <Layout />
      </TransitionProvider>
    ),
    children: [
      { index: true,   element: <HomePage />    },
      { path: 'about', element: <AboutPage />   },
      { path: 'users', element: <UsersPage />   },
      { path: '*',     element: <NotFoundPage /> },
    ],
  },
]);

export default router;