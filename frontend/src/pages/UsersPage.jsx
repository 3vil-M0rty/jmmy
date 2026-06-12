import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

export default function UsersPage() {
  const { t } = useTranslation();
  const [users, setUsers]   = useState([]);
  const [status, setStatus] = useState('loading'); // 'loading' | 'ok' | 'error'

  useEffect(() => {
    fetch('/api/users')
      .then((r) => {
        if (!r.ok) throw new Error(r.statusText);
        return r.json();
      })
      .then((data) => { setUsers(data); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <section className="page">
      <h1>{t('users.title')}</h1>

      {status === 'loading' && <p className="status">{t('users.loading')}</p>}
      {status === 'error'   && <p className="status error">{t('users.error')}</p>}

      {status === 'ok' && (
        <table className="table">
          <thead>
            <tr>
              <th>{t('users.name')}</th>
              <th>{t('users.email')}</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
