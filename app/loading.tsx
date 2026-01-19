export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black">
      <div className="text-center">
        <div className="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-black/20 border-t-black dark:border-white/20 dark:border-t-white"></div>
        <p className="text-sm text-black/60 dark:text-white/60">加载中...</p>
      </div>
    </div>
  );
}
