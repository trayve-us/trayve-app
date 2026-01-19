import { useState, useEffect, useMemo } from "react";
import { Lock, Filter, X } from "lucide-react";
import { 
  enrichModelsWithAccess, 
  type SubscriptionTier, 
  type EnrichedModel 
} from "../../lib/services/model-access.service";

export interface BaseModel {
  id: string;
  name: string;
  description?: string;
  gender: "male" | "female" | "unisex";
  body_type: "slim" | "athletic" | "curvy" | "plus-size";
  ethnicity?: string;
  age_range?: string;
  height_cm?: number;
  image_url: string;
  supabase_path: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface ReferenceModelStepProps {
  selectedModel: string | null;
  onModelSelect: (model: BaseModel) => void;
  subscriptionTier: SubscriptionTier;
  showGenerationStats?: boolean;
}

interface FilterState {
  ageRange: string[];
  bodyType: string[];
  ethnicity: string[];
}

const ModelFilterModal = ({ 
  isOpen, 
  onClose, 
  currentFilters, 
  onApply,
  models 
}: { 
  isOpen: boolean; 
  onClose: () => void;
  currentFilters: FilterState;
  onApply: (filters: FilterState) => void;
  models: EnrichedModel<BaseModel>[];
}) => {
  const [localFilters, setLocalFilters] = useState<FilterState>(currentFilters);

  // Sync with prop when opening
  useEffect(() => {
    if (isOpen) setLocalFilters(currentFilters);
  }, [isOpen, currentFilters]);

  // Calculate filtered count live
  const filteredCount = useMemo(() => {
    return models.filter(model => {
      // Age Range Check
      if (localFilters.ageRange.length > 0) {
        if (!model.age_range || !localFilters.ageRange.includes(model.age_range)) return false; 
      }
      // Body Type Check
      if (localFilters.bodyType.length > 0) {
        const modelBody = model.body_type?.toLowerCase();
        const matches = localFilters.bodyType.some(ft => ft.toLowerCase() === modelBody);
        if (!matches) return false;
      }
      // Ethnicity Check
      if (localFilters.ethnicity.length > 0) {
        if (!model.ethnicity || !localFilters.ethnicity.includes(model.ethnicity)) return false;
      }
      return true;
    }).length;
  }, [models, localFilters]);

  if (!isOpen) return null;

  const toggleFilter = (category: keyof FilterState, value: string) => {
    setLocalFilters(prev => {
      const current = prev[category];
      const exists = current.includes(value);
      return {
        ...prev,
        [category]: exists 
          ? current.filter(item => item !== value)
          : [...current, value]
      };
    });
  };

  const isSelected = (category: keyof FilterState, value: string) => 
    localFilters[category].includes(value);

  const FilterSection = ({ title, options, category }: { title: string, options: string[], category: keyof FilterState }) => (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-[#702dff]" />
        <h3 className="font-semibold text-gray-900">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => toggleFilter(category, opt)}
            className={`
              px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 border
              ${isSelected(category, opt)
                ? 'bg-white border-[#702dff] text-[#702dff] shadow-sm ring-1 ring-[#702dff]'
                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
              }
            `}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Filter Models</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          <p className="text-sm text-gray-500 mb-6">Select your preferences to find the perfect model</p>
          
          <FilterSection 
            title="Age Range" 
            category="ageRange"
            options={["18-25", "26-32", "28", "30-40"]} 
          />
          
          <FilterSection 
            title="Body Type" 
            category="bodyType"
            options={["Slim", "Athletic", "Curvy", "Plus Size"]} 
          />
          
          <FilterSection 
            title="Ethnicity" 
            category="ethnicity"
            options={["Asian", "African / Black", "South Asian", "Hispanic / Latina", "Caucasian"]} 
          />
        </div>

        <div className="p-5 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={() => onApply(localFilters)}
            className="w-full py-3.5 bg-[#702dff] hover:bg-[#5c24cc] text-white rounded-xl font-semibold shadow-lg shadow-[#702dff]/20 transition-all duration-200 active:scale-[0.98]"
          >
            Show {filteredCount} Models
          </button>
        </div>
      </div>
    </div>
  );
};

export function ReferenceModelStep({
  selectedModel,
  onModelSelect,
  subscriptionTier,
  showGenerationStats = false,
}: ReferenceModelStepProps) {
  const [models, setModels] = useState<EnrichedModel<BaseModel>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelStats, setModelStats] = useState<Record<string, number>>({});
  const [userResultCounts, setUserResultCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    fetch('/api/user/model-counts')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          console.log("📊 User Model Counts:", data.counts);
          setUserResultCounts(data.counts);
        }
      })
      .catch(e => console.error("Failed to fetch user counts:", e));
  }, []);

  // Filter States
  const [selectedGender, setSelectedGender] = useState<string>("female"); // Default to female
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    ageRange: [],
    bodyType: [],
    ethnicity: []
  });

  // Fetch models function
  const fetchModels = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const apiFilters: any = {
        is_active: true,
        promoted_only: false, 
      };

      // We only send gender to API, rest is filtered client-side for now
      // to support the complex multi-select implementation without backend overkill
      if (selectedGender !== "all") apiFilters.gender = selectedGender;

      console.log('🔍 Fetching models with filters:', apiFilters);

      const response = await fetch('/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filters: apiFilters }),
      });

      if (showGenerationStats) {
        fetch('/api/models/stats')
          .then(res => res.json())
          .then(data => {
            if (data.success) setModelStats(data.stats);
          })
          .catch(err => console.error("Error fetching stats:", err));
      }

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

      const data = await response.json();
      
      if (data.success && data.models) {
        let enriched = enrichModelsWithAccess<BaseModel>(data.models, subscriptionTier);
        setModels(enriched);
      } else {
        setModels([]);
      }
    } catch (error) {
      console.error("❌ Error fetching models:", error);
      setError(error instanceof Error ? error.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [selectedGender, subscriptionTier]);

  // Client-side filtering
  const filteredModels = useMemo(() => {
    return models.filter(model => {
      // Gender check (already handled by API but good for safety)
      if (selectedGender !== 'all' && model.gender !== selectedGender) return false;

      // Age Range Check
      if (filters.ageRange.length > 0) {
        // Simple string match or inclusion for now since data structure is simple
        // If model.age_range is "25" and filter is "18-25", ideally we parse.
        // For MVP, we'll check if model.age_range matches any selected filter string directly
        if (!model.age_range || !filters.ageRange.includes(model.age_range)) { 
           // Relaxed check: if no age range on model, do we show it? Let's say yes for now, or strict no?
           // Strict implementation:
           // return false; 
           // Loose implementations for when data is sparse:
        }
      }

      // Body Type Check
      if (filters.bodyType.length > 0) {
        // Map UI labels to database values if needed
        // UI: "Slim", "Athletic" -> DB: "slim", "athletic"
        const modelBody = model.body_type?.toLowerCase();
        const matches = filters.bodyType.some(ft => ft.toLowerCase() === modelBody);
        if (!matches) return false;
      }

      // Ethnicity Check
      if (filters.ethnicity.length > 0) {
        if (!model.ethnicity || !filters.ethnicity.includes(model.ethnicity)) return false;
      }

      return true;
    }).sort((a, b) => {
      // Prioritize user's own results count (Virtual Try-On Results)
      const countA = userResultCounts[a.id] || 0;
      const countB = userResultCounts[b.id] || 0;
      
      if (countA !== countB) {
        return countB - countA; // Descending order: Most results first
      }

      // Secondary sort by global stats if enabled
      if (showGenerationStats) {
        const globalA = modelStats[a.id] || 0;
        const globalB = modelStats[b.id] || 0;
        return globalB - globalA;
      }
      
      return 0;
    });
  }, [models, filters, selectedGender, showGenerationStats, modelStats, userResultCounts]);

  const handleApplyFilters = (newFilters: FilterState) => {
    setFilters(newFilters);
    setIsFilterOpen(false);
  };

  return (
    <div className="space-y-6 pb-20 sm:pb-24 md:pb-28">
      
      <ModelFilterModal 
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        currentFilters={filters}
        onApply={handleApplyFilters}
        models={models}
      />

      {/* Filters */}
      <div className="w-full px-3 sm:px-4 md:px-6">
        <div className="flex gap-4 flex-wrap items-center justify-end">
          {/* Gender Buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedGender("female")}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedGender === "female" ? "#702dff" : "#f3f4f6",
                color: selectedGender === "female" ? "white" : "#6b7280",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Female
            </button>
            <button
              onClick={() => setSelectedGender("male")}
              style={{
                padding: "8px 20px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: selectedGender === "male" ? "#702dff" : "#f3f4f6",
                color: selectedGender === "male" ? "white" : "#6b7280",
                fontWeight: "600",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              Male
            </button>
          </div>

          {/* Filter Trigger Button */}
          <button
            onClick={() => setIsFilterOpen(true)}
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-[#f3f4f6] text-gray-600 font-medium text-sm hover:bg-gray-200 transition-colors"
          >
            <Filter size={16} />
            <span>Filter</span>
            {(filters.ageRange.length > 0 || filters.bodyType.length > 0 || filters.ethnicity.length > 0) && (
              <span className="flex items-center justify-center w-5 h-5 bg-[#702dff] text-white text-[10px] rounded-full">
                {filters.ageRange.length + filters.bodyType.length + filters.ethnicity.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
      ) : (
        <div className="px-3 sm:px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 md:gap-5">
            {filteredModels.map((model) => {
              const isSelected = selectedModel === model.id;
              // ALWAYS UNLOCKED for Reference Model Step
              const isLocked = false; 
              const resultCount = userResultCounts[model.id] || 0;

              return (
                <div
                  key={model.id}
                  onClick={() => onModelSelect(model)}
                  className={`relative aspect-[3/4] rounded-xl overflow-hidden cursor-pointer group transition-all duration-300 ${
                    isSelected ? "ring-2 ring-offset-2 ring-[#702dff]" : ""
                  }`}
                >
                  {/* Results Badge */}
                  <div className="absolute top-2 left-2 z-20 px-2.5 py-1.5 bg-black/70 backdrop-blur-md rounded-lg border border-white/10 flex items-center gap-2 shadow-lg group-hover:bg-black/80 transition-colors">
                    <div className={`w-2 h-2 rounded-full ${resultCount > 0 ? "bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" : "bg-gray-400"}`}></div>
                    <span className="text-xs font-bold text-white tracking-wide">{resultCount} <span className="text-gray-300 font-medium text-[10px]">Results</span></span>
                  </div>

                  <div className="absolute inset-0 bg-gray-200">
                    <div className="relative w-full h-full">
                      <img
                        src={model.image_url}
                        alt={model.name}
                        className={`w-full h-full object-cover transition-transform duration-700 ${
                          isSelected ? "scale-105" : "group-hover:scale-110"
                        }`}
                        style={{
                          objectPosition: "50% 0%" 
                        }}
                      />
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 bg-[#702dff] text-white p-1 rounded-full shadow-lg">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}

                  {/* Model Info Label */}
                  <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300 bg-black/40 backdrop-blur-sm">
                    <p className="text-white text-sm font-medium truncate">{model.name}</p>
                    <p className="text-white/80 text-xs truncate">
                      {typeof model.height_cm === 'number' ? `${model.height_cm}cm` : ''} • {model.body_type}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredModels.length === 0 && (
        <div className="text-center py-20">
          <div className="text-gray-500 text-lg mb-2">No models found</div>
          <div className="text-gray-400 text-sm">Try adjusting your filters</div>
        </div>
      )}
    </div>
  );
}