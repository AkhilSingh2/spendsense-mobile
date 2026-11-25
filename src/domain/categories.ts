export type Category = {
  id: string;
  name: string;
  icon: string;
  color: string;
};

export const CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & drink', icon: 'silverware-fork-knife', color: '#C4622D' },
  { id: 'groceries', name: 'Groceries', icon: 'basket-outline', color: '#2F7D4A' },
  { id: 'transport', name: 'Transport', icon: 'tram', color: '#2F6F97' },
  { id: 'housing', name: 'Housing', icon: 'home-city-outline', color: '#8A6232' },
  { id: 'utilities', name: 'Utilities', icon: 'flash-outline', color: '#A37B22' },
  { id: 'shopping', name: 'Shopping', icon: 'shopping-outline', color: '#B14B6A' },
  { id: 'health', name: 'Health', icon: 'heart-pulse', color: '#C44747' },
  { id: 'entertainment', name: 'Entertainment', icon: 'movie-open-outline', color: '#6E4C96' },
  { id: 'subscriptions', name: 'Subscriptions', icon: 'refresh', color: '#3D6484' },
  { id: 'travel', name: 'Travel', icon: 'airplane', color: '#1F8A7B' },
  { id: 'education', name: 'Education', icon: 'school-outline', color: '#4E6B3A' },
  { id: 'personal', name: 'Personal', icon: 'account-outline', color: '#8A6244' },
  { id: 'income', name: 'Income', icon: 'arrow-bottom-left', color: '#0E6B4F' },
  { id: 'other', name: 'Other', icon: 'shape-outline', color: '#6F6A62' },
];

const byId = new Map(CATEGORIES.map((category) => [category.id, category]));

export function categoryById(id: string): Category {
  return byId.get(id) ?? CATEGORIES[CATEGORIES.length - 1]!;
}

export function isCategoryId(id: string): boolean {
  return byId.has(id);
}

export const EXPENSE_CATEGORIES = CATEGORIES.filter((category) => category.id !== 'income');
