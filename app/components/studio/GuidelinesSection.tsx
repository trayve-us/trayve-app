export function GuidelinesSection() {
  return (
    <div className="space-y-4">
      {/* What Works Best */}
      <div className="bg-muted/50 rounded-lg p-6 space-y-4">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-foreground">
            What Works Best
          </h3>
          <p className="text-sm text-muted-foreground">
            Clear photos with good lighting
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <div className="relative rounded overflow-hidden bg-card aspect-[3/4]">
              <img
                src="/studio/wtd_1.png"
                alt="Single Garment"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-center text-foreground font-medium">
              Single Garment
            </p>
          </div>
          <div className="space-y-2">
            <div className="relative rounded overflow-hidden bg-card aspect-[3/4]">
              <img
                src="/studio/wtd_2.png"
                alt="Model Wearing"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-center text-foreground font-medium">
              Model Wearing
            </p>
          </div>
          <div className="space-y-2">
            <div className="relative rounded overflow-hidden bg-card aspect-[3/4]">
              <img
                src="/studio/wtd_3.png"
                alt="Complete Set"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-center text-foreground font-medium">
              Complete Set
            </p>
          </div>
        </div>
      </div>

      {/* What to Avoid */}
      <div className="bg-muted/50 rounded-lg p-6 space-y-4">
        <div className="space-y-0.5">
          <h3 className="text-base font-semibold text-foreground">
            What to Avoid
          </h3>
          <p className="text-sm text-muted-foreground">
            Poor quality or unclear images
          </p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-2">
            <div className="relative rounded overflow-hidden bg-card aspect-[3/4]">
              <img
                src="/studio/wta_1.png"
                alt="Wrinkled"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Wrinkled
            </p>
          </div>
          <div className="space-y-2">
            <div className="relative rounded overflow-hidden bg-card aspect-[3/4]">
              <img
                src="/studio/wta_2.png"
                alt="Cluttered"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Cluttered
            </p>
          </div>
          <div className="space-y-2">
            <div className="relative rounded overflow-hidden bg-card aspect-[3/4]">
              <img
                src="/studio/wta_3.png"
                alt="Incomplete"
                className="w-full h-full object-cover"
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              Incomplete
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
