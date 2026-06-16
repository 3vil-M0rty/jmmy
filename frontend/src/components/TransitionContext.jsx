import { createContext, useContext, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import CameraShutterTransition from './CameraShutterTransition.jsx';

const TransitionContext = createContext(null);

export function TransitionProvider({ children }) {
  const navigate = useNavigate();
  const shutterRef = useRef(null);

  const navigateTo = useCallback((to) => {
    if (shutterRef.current) {
      shutterRef.current.playClose(() => {
        navigate(to);
        shutterRef.current.playOpen();
      });
    } else {
      navigate(to);
    }
  }, [navigate]);

  return (
    <TransitionContext.Provider value={{ navigateTo }}>
      {/* <CameraShutterTransition ref={shutterRef} speed={1.7} /> */}
      {children}
    </TransitionContext.Provider>
  );
}

export const useTransition = () => useContext(TransitionContext);