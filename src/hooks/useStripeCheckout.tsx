import { useState, useCallback } from "react";
import { StripeEmbeddedCheckout } from "@/components/StripeEmbeddedCheckout";

interface Opts {
  priceId: string;
  customerEmail?: string;
  userId?: string;
  returnUrl?: string;
}

export function useStripeCheckout() {
  const [isOpen, setIsOpen] = useState(false);
  const [opts, setOpts] = useState<Opts | null>(null);

  const openCheckout = useCallback((o: Opts) => { setOpts(o); setIsOpen(true); }, []);
  const closeCheckout = useCallback(() => { setIsOpen(false); setOpts(null); }, []);

  const checkoutElement = isOpen && opts ? <StripeEmbeddedCheckout {...opts} /> : null;
  return { openCheckout, closeCheckout, isOpen, checkoutElement };
}