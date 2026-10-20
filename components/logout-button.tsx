import { logoutAction } from "@/app/actions/auth";
import { buttonClasses } from "./ui";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button type="submit" className={buttonClasses("ghost", "sm")}>
        Salir
      </button>
    </form>
  );
}
