import { productIdentity } from '@happier-dev/release-runtime/productIdentity';

const repositoryUrl = `https://github.com/${productIdentity.githubRepo}`;

/** External pages about the product. Documentation is read from the repository's default branch. */
export const productLinks = {
    repository: repositoryUrl,
    readme: `${repositoryUrl}#readme`,
    /** `pagePath` is relative to `apps/docs/content/docs`, without the `.mdx` extension. */
    docsPage: (pagePath: string): string => `${repositoryUrl}/blob/HEAD/apps/docs/content/docs/${pagePath}.mdx`,
} as const;
