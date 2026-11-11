"use client";
import { makeAuthClient } from "@ecom/auth/client";

export const authClient = makeAuthClient("/api/auth");
