export function getSkeletonCount(params: {
  isLoading: boolean | undefined;
  postsLength: number;
  singleColumn: boolean | undefined;
}): { showSkeletons: boolean; skeletonCount: number } {
  const { isLoading, postsLength, singleColumn } = params;

  const showSkeletons = !!isLoading;
  const initialSkeletonCount = singleColumn ? 1 : 4;
  const trailingSkeletonCount = 1;
  const skeletonCount = postsLength === 0 ? initialSkeletonCount : trailingSkeletonCount;

  return { showSkeletons, skeletonCount };
}
