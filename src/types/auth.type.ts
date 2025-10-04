export interface PayloadLogin {
  username: string;
  password: string;
  type?: 'email' | 'phone';
  callback?: (error?: any) => void; // Optional callback for success
}

export interface PayloadRegister {
    fullname: string;
    username: string;
    password: string;
    confirm: string;
    gender: 'male' | 'female' | 'other';
    dateOfBirth: string;
    type?: 'email' | 'phone';
    callback?: (error?: any) => void; // Optional callback for success
}


export interface User {
  _id: string; // mongodb objectId
  id: string;
  fullname: string;
  slug: string;
  email?: string; 
  phone: string;
  avatar: string;
  gender: 'male' | 'female' | 'other'; 
  dateOfBirth: string;
  createdAt: string;  
  updatedAt: string;   
}

export interface AuthMetadata {
    accessToken: string;
    refreshToken: string;
    expiresIn: number; // Thời gian token hết hạn (tính bằng giây)
    user: User;
}

export interface AuthResponse {
    message: string;
    statusCode: number;
    reasonStatusCode: string;
    metadata: AuthMetadata | null;
}