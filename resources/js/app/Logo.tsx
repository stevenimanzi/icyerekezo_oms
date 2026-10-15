const DEFAULT_SYSTEM_LOGO = "/assets/images/icyerekezo_oms_logo.svg";

export function Logo({ name = "ICYEREKEZO OMS", logoUrl = DEFAULT_SYSTEM_LOGO }: { name?: string; logoUrl?: string } = {}) {
  const words = name.split(" ");
  const suffix = words.length > 1 ? words.pop() : "OMS";
  return (
    <div className="brand">
      {logoUrl === DEFAULT_SYSTEM_LOGO ? (
        <img className="brand-logo" src={logoUrl} alt={name} />
      ) : (
        <>
          <div className="brand-mark">
            <img src={logoUrl} alt="" />
          </div>
          <div>
            <strong>{words.join(" ")}</strong>
            <span>{suffix}</span>
          </div>
        </>
      )}
    </div>
  );
}
