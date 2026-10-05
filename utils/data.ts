/** Test data gathered during exploratory sessions (see Exploratory Log sheet). */
export const BRANCHES = ['Benin City', 'Ikeja', 'Lekki', 'Owerri', 'Lagos'] as const;
export type Branch = (typeof BRANCHES)[number];

/** Hotel-level room that the quote API accepts (Standard Room, N242/night). */
export const BOOKABLE_ROOM_ID = '965c310d-7b91-46b3-b2aa-3053c19ec203';
/** Branch-level room for which GET /api/rooms/{id} returned 404 (BUG-008). */
export const BRANCH_ROOM_ID = 'f7a8b3a8-4524-4bd9-91f7-e39794917c3f';

export const GUEST = {
  fullName: 'QA Tester',
  email: 'qa.tester@example.com',
  phone: '+2348012345678',
};

export const CONTACT = {
  name: 'Ada Obi',
  email: 'ada@example.com',
  phone: '+2348012345678',
  subject: 'Automated test enquiry',
  message: 'Automated test message - please ignore.',
};

export const XSS = '<script>alert(1)</script>';

export const STATIC_PAGES = ['/', '/rooms', '/branches', '/gallery', '/about', '/contact'] as const;
export const POLICY_PAGES = ['/privacy-policy', '/terms', '/cancellation-policy'] as const;

export const NAIRA = /₦\s?[\d,]+(\.\d{2})?/;
export const parseNaira = (s: string) => Number(s.replace(/[^\d.]/g, ''));
