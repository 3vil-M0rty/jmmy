import { RouterProvider } from 'react-router-dom';
import { Suspense } from 'react';
import { useTranslation } from 'react-i18next';
import router from './router/index.jsx';

function LoadingScreen() {
  const { t } = useTranslation();
  return <div className="loading-screen">{t('common.loading')}</div>;
}

export default function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <RouterProvider router={router} />
    </Suspense>
  );
}
