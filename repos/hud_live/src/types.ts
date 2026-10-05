export interface Request {
  id: string;
  clientId: string;
  title: string;
  titleEn: string;
  type: string;
  location: string;
  date: string;
  guests: number;
  budget: string;
  service: string;
  expiresAt: number;
  vendorCount: number;
  status: 'live' | 'expired' | 'confirmed' | 'completed';
  hasUnreadBids?: boolean;
}

export interface Bid {
  id: string;
  requestId: string;
  vendorId: string;
  vendorName: string;
  vendorPhone?: string;
  vendorRating: number;
  amount: number;
  remarks?: string;
  vendorWebsite?: string;
  vendorPortfolio?: string[];
  status: 'pending' | 'accepted' | 'rejected';
  createdAt?: any;
  isReadByVendor?: boolean;
}
