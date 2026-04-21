"use client";

import { useEffect, useState } from "react";
import { getUserRoles, type PortalRole } from "@/lib/portal-auth";

type UsePortalRolesOptions = {
  onError?: (error: unknown) => void;
};

export function usePortalRoles(options: UsePortalRolesOptions = {}) {
  const { onError } = options;
  const [roles, setRoles] = useState<PortalRole[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadRoles = async () => {
      try {
        const { roles: nextRoles } = await getUserRoles();
        if (isMounted) {
          setRoles(nextRoles);
        }
      } catch (error) {
        onError?.(error);
        if (isMounted) {
          setRoles([]);
        }
      }
    };

    void loadRoles();

    return () => {
      isMounted = false;
    };
  }, [onError]);

  return roles;
}
