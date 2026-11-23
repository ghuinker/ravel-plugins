// Same rules as the core's `setUsername`, checked first so a typo never leaves the page.
export const USERNAME_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const USERNAME_MAX = 30;

export const validUsername = (name: string) => name.length > 0 && name.length <= USERNAME_MAX && USERNAME_PATTERN.test(name);
