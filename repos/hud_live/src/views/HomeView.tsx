import LiveFeed from '../components/feed/LiveFeed';
import { motion } from 'motion/react';

export default function HomeView() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <LiveFeed />
    </motion.div>
  );
}
