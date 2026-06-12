import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

export default function NotFoundPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <section className="page hero">
      <h1>{t('notFound.title')}</h1>
      <button className="btn" onClick={() => navigate('/')}>
        {t('notFound.back')}
      </button>
    </section>
  );
}
