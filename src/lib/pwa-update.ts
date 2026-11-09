export const ACTIVATE_WAITING_WORKER_MESSAGE = "ALO_ACTIVATE_WAITING_WORKER";

type WaitingWorker = {
  postMessage: (message: { type: string }) => void;
};

export function requestWaitingWorkerActivation(worker: WaitingWorker | null | undefined) {
  if (!worker) return false;
  try {
    worker.postMessage({ type: ACTIVATE_WAITING_WORKER_MESSAGE });
    return true;
  } catch {
    return false;
  }
}
