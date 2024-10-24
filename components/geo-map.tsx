"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { ResponsiveChoroplethCanvas } from "@nivo/geo";
import { CountryGeoMapData } from "@/services/geo-map-service";
import worldCountries from "@/data/world_countries.json";

interface GeoMapProps {
  data: CountryGeoMapData[];
}

function useWindowWidth() {
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    function handleResize() {
      setWidth(window.innerWidth);
    }
    handleResize(); // Set initial width
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return width;
}

const GeoMap: React.FC<GeoMapProps> = ({ data }) => {
  const width = useWindowWidth();
  const [selectedCountry, setSelectedCountry] = useState<any>(null);
  const tooltipRef = useRef<HTMLDivElement>(null); // Reference for the tooltip

  const handleCountryClick = (feature: any) => {
    const countryId = feature.id || "Unknown"; // Use `id` from GeoJSON
    const countryData = data.find((item) => item.id === countryId);
    if (countryData) {
      setSelectedCountry({
        name: feature.properties?.name || "Unknown",
        data: countryData,
      });
    }
  };

  const handleClickOutside = (event: MouseEvent) => {
    if (
      tooltipRef.current &&
      !tooltipRef.current.contains(event.target as Node)
    ) {
      setSelectedCountry(null); // Hide the tooltip if clicked outside
    }
  };

  useEffect(() => {
    // Add event listener to detect clicks outside the tooltip
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      // Cleanup the event listener when the component is unmounted
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // const [zoom, setZoom] = useState(1);
  const [zoom, setZoom] = useState(1);
  const MIN_ZOOM = 1; // Set your desired minimum zoom level
  const MAX_ZOOM = 3; // Set your desired maximum zoom level
  const scaleFactors = {
    extraSmall: 80, // For widths < 576
    small: 120, // For widths 576-767
    medium: 150, // For widths 768-991
    large: 180, // For widths 992-1199
    extraLarge: 220, // For widths >= 1200
  };
  const [projectionScale, setProjectionScale] = useState(100); // Default scale

  const getScaleForWidth = (width: number) => {
    if (width < 576) {
      return scaleFactors.extraSmall; // Extra Small Devices
    } else if (width >= 576 && width < 768) {
      return scaleFactors.small; // Small Devices
    } else if (width >= 768 && width < 992) {
      return scaleFactors.medium; // Medium Devices
    } else if (width >= 992 && width < 1200) {
      return scaleFactors.large; // Large Devices
    } else {
      return scaleFactors.extraLarge; // Extra Large Devices
    }
  };

  const getWidthForScale = (scale: number) => {
    if (scale <= scaleFactors.extraSmall) {
      return 576; // Extra small devices
    } else if (scale <= scaleFactors.small) {
      return 768; // Small Devices
    } else if (scale <= scaleFactors.medium) {
      return 992; // Medium Devices
    } else if (scale <= scaleFactors.large) {
      return 1200; // Large Devices
    } else {
      return 1536; // Extra Large Devices
    }
  };

  const adjustProjectionScale = (width: number, zoom: number) => {
    const baseScale = getScaleForWidth(width);
    return zoom * baseScale;
  };

  useEffect(() => {
    const handleResize = () => {
      setProjectionScale(adjustProjectionScale(window.innerWidth, zoom));
    };

    // Attach resize event listener
    window.addEventListener("resize", handleResize);
    handleResize(); // Initial calculation on mount

    // Cleanup on unmount
    return () => window.removeEventListener("resize", handleResize);
  }, [width, zoom]);

  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false); // State to track dragging
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  ); // Starting coordinates for drag

  const handleZoom = useCallback((delta: number) => {
    setZoom((prev) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev + delta))); // Prevent zooming out too far
  }, []);

  const handlePan = useCallback(
    (dx: number, dy: number) => {
      // Calculate the dimensions of the visible area of the map      
      // const visibleWidth = (window.innerWidth / zoom) ;
      // const visibleHeight = (window.innerHeight / zoom);      

      const visibleWidth = (getWidthForScale(projectionScale) / zoom) ;
      const visibleHeight = (window.innerHeight / zoom);            
  
      // Calculate the pan factors
      const panFactor = 0.5; // Adjust this value to control pan step size (lower values = smaller steps)
      const adjustedDx = dx * panFactor;
      const adjustedDy = dy * panFactor;
  
      setTranslate((prev) => {
        let newX = prev.x + adjustedDx;
        let newY = prev.y + adjustedDy;
  
        // Calculate max and min boundaries for panning
        const maxX = visibleWidth ;
        const maxY = visibleHeight ;
  
        // Restrict panning within the defined boundaries
        newX = Math.max(-maxX, Math.min(newX, maxX));
        newY = Math.max(-maxY, Math.min(newY, maxY));
  
        return { x: newX, y: newY };
      });
    },
    [zoom, projectionScale, width]
  );

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      handleZoom(event.deltaY > 0 ? -0.1 : 0.1);
    },
    [handleZoom]
  );

  useEffect(() => {
    const mapContainer = document.getElementById("map-container");
    if (mapContainer) {
      mapContainer.addEventListener("wheel", handleWheel);
    }
    return () => {
      if (mapContainer) {
        mapContainer.removeEventListener("wheel", handleWheel);
      }
    };
  }, [handleWheel]);

  const handleMouseDown = useCallback((event: MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: event.clientX, y: event.clientY });
  }, []);

  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!isDragging || !dragStart) return;

      const dx = event.clientX - dragStart.x;
      const dy = event.clientY - dragStart.y;
      handlePan(dx, dy);

      // Update drag start position
      setDragStart({ x: event.clientX, y: event.clientY });
    },
    [isDragging, dragStart, handlePan]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null); // Reset drag start
  }, []);

  // Touch events (smart phone)
  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (event.touches.length === 1) {
      // Single touch for panning
      const touch = event.touches[0];
      setIsDragging(true);
      setDragStart({ x: touch.clientX, y: touch.clientY });
    }
  }, []);

  const handleTouchMove = useCallback(
    (event: TouchEvent) => {
      if (!isDragging || !dragStart) return;

      const touch = event.touches[0];
      const dx = touch.clientX - dragStart.x;
      const dy = touch.clientY - dragStart.y;
      handlePan(dx, dy);

      // Update drag start position
      setDragStart({ x: touch.clientX, y: touch.clientY });
    },
    [isDragging, dragStart, handlePan]
  );

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
    setDragStart(null); // Reset drag start
  }, []);

  useEffect(() => {
    const mapContainer = document.getElementById("map-container");
    if (mapContainer) {
      mapContainer.addEventListener("wheel", handleWheel);
      mapContainer.addEventListener("mousedown", handleMouseDown);
      mapContainer.addEventListener("mousemove", handleMouseMove);
      mapContainer.addEventListener("mouseup", handleMouseUp);
      mapContainer.addEventListener("mouseleave", handleMouseUp); // Handle mouse leaving the container

      // Add touch event listeners
      mapContainer.addEventListener("touchstart", handleTouchStart);
      mapContainer.addEventListener("touchmove", handleTouchMove);
      mapContainer.addEventListener("touchend", handleTouchEnd);
    }
    return () => {
      if (mapContainer) {
        mapContainer.removeEventListener("wheel", handleWheel);
        mapContainer.removeEventListener("mousedown", handleMouseDown);
        mapContainer.removeEventListener("mousemove", handleMouseMove);
        mapContainer.removeEventListener("mouseup", handleMouseUp);
        mapContainer.removeEventListener("mouseleave", handleMouseUp);

        // Remove touch event listeners
        mapContainer.removeEventListener("touchstart", handleTouchStart);
        mapContainer.removeEventListener("touchmove", handleTouchMove);
        mapContainer.removeEventListener("touchend", handleTouchEnd);
      }
    };
  }, [
    handleWheel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  ]);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={() => handleZoom(-0.1)}
          onTouchStart={() => handleZoom(-0.1)}
        >
          Zoom Out
        </button>
        <button
          onClick={() => handleZoom(0.1)}
          onTouchStart={() => handleZoom(0.1)}
        >
          Zoom In
        </button>
      </div>

      <div
        id="map-container"
        className="h-[50vh] sm:h-[60vh] md:h-[70vh] lg:h-[80vh] relative"
      >
        <ResponsiveChoroplethCanvas
          tooltip={() => null} // Disable hover-based tooltip
          onClick={(feature) => handleCountryClick(feature)} // Show tooltip on click
          data={data}
          features={worldCountries.features}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          colors="nivo"
          domain={[0, 1000000]}
          projectionType="naturalEarth1"
          projectionScale={projectionScale}
          projectionTranslation={[
            0.5 + translate.x / projectionScale,
            0.5 + translate.y / projectionScale,
          ]}
          projectionRotation={[0, 0, 0]}
          enableGraticule={true}
          fillColor="#eeeeee"
          borderWidth={0.5}
          borderColor="#333333"
          graticuleLineColor="#666666"
        />
        {/* Show tooltip if a country is clicked */}
        {selectedCountry && (
          <div
            ref={tooltipRef} // Attach ref to the tooltip element
            className="bg-white dark:bg-gray-800 dark:text-gray-200 text-black p-3 rounded-md shadow-md border border-gray-300 dark:border-gray-700 max-w-[300px] absolute"
            style={{
              maxHeight: "400px",
              overflowY: "auto",
              top: "20%",
              left: "20%",
              zIndex: 1000, // Ensure the tooltip appears above other content
              pointerEvents: "auto", // Make sure it's clickable
            }}
          >
            <strong>{selectedCountry.name}</strong>
            <br />
            <strong>
              Resources: {selectedCountry.data.resourceList?.length ?? 0}
            </strong>
            {selectedCountry.data.resourceList?.length > 0 ? (
              <ul className="mt-2 space-y-1 max-h-[200px] overflow-y-auto">
                {selectedCountry.data.resourceList.map((resource: any) => (
                  <li key={resource.id}>
                    <a
                      href={resource.mainLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 dark:text-blue-300"
                    >
                      {resource.name} - Published on{" "}
                      {new Date(resource.publicationDate).toLocaleDateString()}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <div>No resources available</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default GeoMap;
