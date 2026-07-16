"use client";

import { useState, useMemo, useCallback } from "react";
import { X, Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface TickerOption {
  value: string;
  label: string;
  display: string;
}

interface TickerFilterProps {
  options: TickerOption[];
  selectedValues: string[];
  onSelect: (values: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function TickerFilter({
  options,
  selectedValues = [],
  onSelect,
  placeholder = "Filter by ticker or name...",
  className,
}: TickerFilterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Filter options for the command list based on search
  const commandOptions = useMemo(() => {
    if (!search) return options;
    
    const searchLower = search.toLowerCase();
    return options.filter(
      (option) =>
        option.value.toLowerCase().includes(searchLower) ||
        option.label.toLowerCase().includes(searchLower) ||
        option.display.toLowerCase().includes(searchLower)
    );
  }, [options, search]);
  
  // Always show all options in the dropdown, regardless of search
  const dropdownOptions = useMemo(() => {
    return options;
  }, [options]);

  const handleSelect = useCallback((value: string) => {
    const newSelected = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onSelect(newSelected);
    // Clear search after selection to make it easier to select more items
    setSearch('');
  }, [selectedValues, onSelect]);

  const handleRemove = (value: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(selectedValues.filter((v) => v !== value));
    // Clear search when removing an item to reset the view
    setSearch('');
  };

  const selectedOptions = useMemo(() => {
    return options.filter(option => selectedValues.includes(option.value));
  }, [options, selectedValues]);

  return (
    <div className={cn("flex flex-col gap-2 w-full", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between h-auto min-h-10 py-2 text-left font-normal"
          >
            <div className="flex flex-wrap gap-1 overflow-hidden max-h-12">
              {selectedOptions.length > 0 ? (
                selectedOptions.map((option) => (
                  <div
                    key={option.value}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  >
                    <span>{option.display}</span>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => handleRemove(option.value, e)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleRemove(option.value, e as any);
                        }
                      }}
                      className="ml-1 rounded-full hover:bg-muted p-0.5 focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                      aria-label={`Remove ${option.display}`}
                    >
                      <X className="h-3 w-3" />
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              placeholder={placeholder}
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>No tickers found.</CommandEmpty>
              <CommandGroup className="max-h-[300px] overflow-y-auto">
                {dropdownOptions.map((option) => {
                  const isSelected = selectedValues.includes(option.value);
                  return (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      onSelect={() => handleSelect(option.value)}
                      className="cursor-pointer"
                    >
                      <div
                        className={cn(
                          "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "opacity-50 [&_svg]:invisible"
                        )}
                      >
                        <Check className={cn("h-4 w-4")} />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{option.display}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.label}
                        </div>
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selectedOptions.length > 0 && (
        <div className="flex flex-wrap gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => onSelect([])}
          >
            Clear all
          </Button>
        </div>
      )}
    </div>
  );
}
