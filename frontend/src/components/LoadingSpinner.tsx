interface LoadingSpinnerProps {
  message?: string;
}

export default function LoadingSpinner({ message = '加载中...' }: LoadingSpinnerProps) {
  return (
    <div className="loading-spinner">
      <div className="spinner"></div>
      <p>{message}</p>
    </div>
  );
}
