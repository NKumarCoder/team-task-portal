import { collection } from 'firebase/firestore';
import { db } from './config';

// Collection references matching the exact requirements
export const usersCollection = collection(db, 'users');
export const tasksCollection = collection(db, 'tasks');
export const settingsCollection = collection(db, 'settings');
export const monthlyReportsCollection = collection(db, 'monthlyReports');
export const commentsCollection = collection(db, 'taskComments');
export const notificationsCollection = collection(db, 'notifications');
export const activitiesCollection = collection(db, 'taskActivities');
export const projectsCollection = collection(db, 'projects');
