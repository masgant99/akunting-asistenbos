import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where, 
  orderBy, 
  getDocs,
  Timestamp,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Generic CRUD helpers
export const subscribeToCollection = <T>(
  path: string, 
  callback: (data: T[]) => void,
  userId?: string,
  filterQuery?: any
) => {
  // Security: Always filter by userId if provided, or default to current user
  const effectiveUserId = userId || auth.currentUser?.uid;
  
  if (!effectiveUserId) {
    console.warn(`No user ID provided for collection subscription: ${path}`);
    return () => {};
  }

  let finalQuery = filterQuery;
  
  if (!finalQuery) {
    finalQuery = query(
      collection(db, path), 
      where('userId', '==', effectiveUserId),
      orderBy('createdAt', 'desc')
    );
  } else {
    // If a filterQuery is provided, it must also include the userId filter to pass security rules
    // This is a bit tricky with the Firestore SDK as we can't easily merge queries
    // For now, we assume the caller provides a query that includes userId if they provide filterQuery
  }
  
  return onSnapshot(finalQuery, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as T));
    callback(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const addDocument = async (path: string, data: any) => {
  try {
    const docRef = await addDoc(collection(db, path), {
      ...data,
      userId: auth.currentUser?.uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    throw error;
  }
};

export const updateDocument = async (path: string, id: string, data: any) => {
  try {
    const docRef = doc(db, path, id);
    return await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${path}/${id}`);
  }
};

export const deleteDocument = async (path: string, id: string) => {
  try {
    return await deleteDoc(doc(db, path, id));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${path}/${id}`);
  }
};

export const getDocument = async <T>(path: string, id: string) => {
  try {
    const docSnap = await getDoc(doc(db, path, id));
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    return null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${path}/${id}`);
  }
};
