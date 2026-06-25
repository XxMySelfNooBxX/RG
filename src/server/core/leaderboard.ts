export type RedditClient = {
  setUserFlair(options: {
    subredditName: string;
    username: string;
    text?: string;
    flairTemplateId?: string;
    cssClass?: string;
    textColor?: 'light' | 'dark';
    backgroundColor?: string;
  }): Promise<void>;
};

// Retry helper with exponential backoff
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 200): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    console.warn(`Reddit API call failed. Retrying in ${delay}ms... Remaining retries: ${retries}. Error:`, error);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

export async function awardFlairToUser(
  reddit: RedditClient,
  subredditName: string,
  username: string,
  flairName: string
): Promise<void> {
  if (username === 'anonymous') {
    console.info('Skipping flair award for anonymous user');
    return;
  }

  console.info(`Attempting to award flair "${flairName}" to user "${username}" in subreddit "${subredditName}"`);
  
  try {
    await retry(async () => {
      await reddit.setUserFlair({
        subredditName,
        username,
        text: flairName,
      });
    });
    console.info(`Successfully awarded flair "${flairName}" to "${username}"`);
  } catch (error) {
    console.error(`Failed to award flair "${flairName}" to "${username}" after retries:`, error);
  }
}

export async function checkAndAwardFlair(
  reddit: RedditClient,
  subredditName: string,
  username: string,
  casesSolved: number
): Promise<string | null> {
  let flairToAward: string | null = null;

  // Determine if a milestone is reached
  if (casesSolved === 1) {
    flairToAward = '🕵️ Caseboard Detective';
  } else if (casesSolved === 5) {
    flairToAward = '🔍 Investigator';
  } else if (casesSolved === 20) {
    flairToAward = '👁️ Detective';
  } else if (casesSolved === 50) {
    flairToAward = '🎩 Inspector';
  } else if (casesSolved === 100) {
    flairToAward = '⭐ Chief Detective';
  }

  if (flairToAward) {
    // Fire and forget or await
    await awardFlairToUser(reddit, subredditName, username, flairToAward);
    return flairToAward;
  }

  return null;
}
