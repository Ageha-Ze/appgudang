import toast, { Toaster } from 'react-hot-toast';

// Custom toast functions dengan styling konsisten
export const customToast = {
  success: (message: string) => {
    return toast.success(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#10b981',
        color: '#fff',
        fontWeight: '500',
        padding: '16px',
        borderRadius: '10px',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#10b981',
      },
    });
  },

  error: (message: string) => {
    return toast.error(message, {
      duration: 5000,
      position: 'top-right',
      style: {
        background: '#ef4444',
        color: '#fff',
        fontWeight: '500',
        padding: '16px',
        borderRadius: '10px',
      },
      iconTheme: {
        primary: '#fff',
        secondary: '#ef4444',
      },
    });
  },

  loading: (message: string) => {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#3b82f6',
        color: '#fff',
        fontWeight: '500',
        padding: '16px',
        borderRadius: '10px',
      },
    });
  },

  promise: (promise: Promise<any>, messages: { loading: string; success: string; error: string }) => {
    return toast.promise(
      promise,
      {
        loading: messages.loading || 'Loading...',
        success: messages.success || 'Success!',
        error: messages.error || 'Error occurred',
      },
      {
        position: 'top-right',
        style: {
          fontWeight: '500',
          padding: '16px',
          borderRadius: '10px',
        },
        success: {
          duration: 4000,
          style: {
            background: '#10b981',
            color: '#fff',
          },
        },
        error: {
          duration: 5000,
          style: {
            background: '#ef4444',
            color: '#fff',
          },
        },
      }
    );
  },

  warning: (message: string) => {
    return toast(message, {
      duration: 4000,
      position: 'top-right',
      style: {
        background: '#f59e0b',
        color: '#fff',
        fontWeight: '500',
        padding: '16px',
        borderRadius: '10px',
      },
      icon: '⚠️',
    });
  },

  info: (message: string) => {
    return toast(message, {
      duration: 3000,
      position: 'top-right',
      style: {
        background: '#6b7280',
        color: '#fff',
        fontWeight: '500',
        padding: '16px',
        borderRadius: '10px',
      },
      icon: 'ℹ️',
    });
  },

  custom: (content: React.ReactNode, options: any = {}) => {
    return toast.custom((t) => (
      <div
        className={`${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-white shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
      >
        <div className="flex-1 w-0 p-4">
          <div className="flex items-start">
            <div className="ml-3 flex-1">
              {content}
            </div>
          </div>
        </div>
        <div className="flex border-l border-gray-200">
          <button
            onClick={() => toast.dismiss(t.id)}
            className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
          >
            Close
          </button>
        </div>
      </div>
    ), options);
  },
};

// Toaster component configuration
export const ToasterConfig = () => (
  <Toaster
    position="top-right"
    reverseOrder={false}
    gutter={8}
    toastOptions={{
      // Default options untuk semua toast
      duration: 4000,
      style: {
        fontWeight: '500',
        padding: '16px',
        borderRadius: '10px',
      },
    }}
  />
);

export default customToast;
