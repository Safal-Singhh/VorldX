import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { AmbientBackground } from "../components/ambient";

export function PublicPortal() {
  return (
    <div className="min-h-screen grid place-items-center p-6 relative overflow-hidden">
      <AmbientBackground />
      <motion.div
        className="glass p-8 w-full max-w-md text-center relative"
        style={{ zIndex: 1 }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="brand text-xl">VorldX</div>
        <p className="text-sm mt-2" style={{ color: "var(--vx-text-secondary)" }}>Employee attendance for office and remote teams.</p>
        <div className="grid gap-2 mt-6">
          <Link className="btn-primary text-center" to="/company/signup">Create a company account</Link>
          <Link className="btn-secondary text-center" to="/login">Sign in</Link>
        </div>
      </motion.div>
    </div>
  );
}
