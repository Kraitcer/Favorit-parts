import Icon from './Icon.jsx';

export function Loader({ children }) {
  return <div className="feedback" role="status"><span className="spinner-border spinner-border-sm" aria-hidden="true" /><span>{children}</span></div>;
}

export function ErrorMessage({ message, onRetry }) {
  return <div className="error-box" role="alert">
    <Icon name="info" />
    <div><strong>Не удалось выполнить запрос</strong><p>{message}</p>
      <button className="btn btn-sm btn-outline-danger" onClick={onRetry}>Повторить запрос</button>
    </div>
  </div>;
}

export function EmptyState({ title, children, icon = 'search' }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name={icon} size={27} /></span><h3>{title}</h3><p>{children}</p></div>;
}
