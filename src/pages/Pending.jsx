import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import useStore from '../store/useStore';
import { Clock, Phone } from 'lucide-react';

// ── Shown when the user's phone number has no shop registered by the admin yet
export default function Pending() {
  const navigate = useNavigate();
  const { user, setUser, setShop } = useStore();

  const handleSignOut = async () => {
    await signOut(auth);
    setUser(null);
    setShop(null);
    navigate('/login', { replace: true });
  };

  // Format phone nicely: +919876543210 → +91 98765 43210
  const phone = user?.phoneNumber || '';
  const formatted = phone.startsWith('+91')
    ? `+91 ${phone.slice(3, 8)} ${phone.slice(8)}`
    : phone;

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-dark to-brand-mid flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl">
        <Clock className="w-10 h-10 text-brand-mid" />
      </div>

      <h1 className="text-2xl font-bold text-white mb-2">Shop Not Registered</h1>
      <p className="text-brand-light text-sm mb-6 max-w-xs">
        Your number is not yet registered with NatBolt Billu.
        Contact the admin to get your shop set up.
      </p>

      <div className="bg-white/10 rounded-2xl px-6 py-4 mb-8 text-white">
        <p className="text-xs text-brand-light mb-1">Signed in as</p>
        <p className="font-bold text-lg">{formatted}</p>
      </div>

      <a
        href={`https://wa.me/919738007523?text=${encodeURIComponent(`Hi, please register my shop on NatBolt Billu. My number is ${formatted}`)}`}
        className="flex items-center gap-2 bg-green-500 text-white font-semibold px-6 py-3 rounded-xl mb-4"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Phone className="w-4 h-4" />
        Contact Admin on WhatsApp
      </a>

      <button
        onClick={handleSignOut}
        className="text-brand-light text-sm underline"
      >
        Sign out
      </button>
    </div>
  );
}
