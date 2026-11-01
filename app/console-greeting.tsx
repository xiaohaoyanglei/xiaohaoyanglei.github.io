"use client";

import { useEffect } from "react";

let greeted = false;

export default function ConsoleGreeting({ email }: { email: string }) {
  useEffect(() => {
    if (greeted) return;
    greeted = true;
    console.info(
      "%c☾ Hello, fellow night owl.%c\nThe portrait on this page is denoised from fresh Gaussian noise on every visit (40 steps, cosine schedule).\nIf you read source code for fun, we should talk: " +
        email,
      "font: 600 15px Georgia, serif; color: #f3ba5d;",
      "font: 12px ui-monospace, monospace; color: #a3adc4;",
    );
  }, [email]);
  return null;
}
