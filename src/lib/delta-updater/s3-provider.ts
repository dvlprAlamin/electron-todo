interface UpdateConfig {
  bucket?: string;
  region?: string;
  path?: string;
}

export const getS3FeedURL = async (
  updateConfig: UpdateConfig
): Promise<string | null> => {
  const { bucket, region, path } = updateConfig;

  if (!bucket) {
    return null;
  }

  const regionPart = region ? `${region}.` : '';
  const pathPart = path || '';

  return `https://${bucket}.s3.${regionPart}amazonaws.com/${pathPart}`;
};
