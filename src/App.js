import React, { useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import styled from 'styled-components';

const DropZone = styled.div`
  border: 2px dashed #cccccc;
  border-radius: 4px;
  padding: 20px;
  text-align: center;
  margin: 20px;
  min-height: 200px;
`;

const FileList = styled.div`
  margin: 20px;
`;

const FileItem = styled.div`
  padding: 10px;
  margin: 5px 0;
  background-color: #f5f5f5;
  border-radius: 4px;
`;

const MergeButton = styled.button`
  padding: 10px 20px;
  background-color: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 20px;
  width: calc(100% - 40px);  // margin 20px를 고려하여 계산
  
  &:hover {
    background-color: #45a049;
  }
`;

function App() {
  const [files, setFiles] = useState([]);

  const handleDragOver = (event) => {
    event.preventDefault();
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    const newFiles = Array.from(event.dataTransfer.files);
    const jsonFiles = newFiles.filter(file => file.name.endsWith('.json') || file.name.endsWith('.geojson'));
    
    // 파일 이름에서 data_type 확인
    const isValidFile = jsonFiles.some(file => {
      const fileName = file.name.toLowerCase();
      return fileName.includes('_floor_') || 
             fileName.includes('_sector_') || 
             fileName.includes('_poi_');
    });

    if (!isValidFile) {
      alert('최소 하나의 파일 이름에는 floor, sector, poi 중 하나가 포함되어야 합니다.');
      return;
    }
    
    const filesWithContent = await Promise.all(
      jsonFiles.map(async (file) => {
        const content = await file.text();
        const parsedContent = JSON.parse(content);
        
        // 파일 이름에 따라 data_type 결정
        let dataType = null;
        const fileName = file.name.toLowerCase();
        if (fileName.includes('_floor_')) dataType = 'floor';
        else if (fileName.includes('_sector_')) dataType = 'sector';
        else if (fileName.includes('_poi_')) dataType = 'poi';
        
        // 각 feature에 data_type 추가
        if (dataType && parsedContent.features) {
          parsedContent.features = parsedContent.features.map(feature => ({
            ...feature,
            properties: {
              ...feature.properties,
              data_type: dataType
            }
          }));
        }

        return {
          name: file.name,
          content: parsedContent
        };
      })
    );
    
    setFiles([...files, ...filesWithContent]);
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    
    const items = Array.from(files);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);
    
    setFiles(items);
  };

  const handleMerge = () => {
    if (files.length === 0) return;

    const keyMappings = {
      'created_da': 'created_date',
      'category_c': 'category_code',
      'primary_ca': 'primary_category',
      'secondary_': 'secondary_category',
      'tertiary_c': 'tertiary_category',
      'road_addre': 'road_address',
      'opening_ye': 'opening_year',
      'business_h': 'business_hours',
      "store_numb": "store_number"
    };

    // 파일 유효성 재확인
    const hasValidFileType = files.some(file => {
      const fileName = file.name.toLowerCase();
      return fileName.includes('_floor_') || 
             fileName.includes('_sector_') || 
             fileName.includes('_poi_');
    });

    if (!hasValidFileType) {
      alert('최소 하나의 파일 이름에는 floor, sector, poi 중 하나가 포함되어야 합니다.');
      return;
    }

    const mergedFeatures = files.reduce((acc, file) => {
      return [...acc, ...file.content.features];
    }, []);

    const resultGeoJson = {
      type: "FeatureCollection",
      features: mergedFeatures.map((feature) => {
        const newFeature = {};
        
        if (feature.properties && feature.properties.id) {
          newFeature.id = feature.properties.id;
          const { id, ...restProperties } = feature.properties;
          feature.properties = restProperties;
        }

        if (feature.properties) {
          const newProperties = {};
          Object.entries(feature.properties).forEach(([key, value]) => {
            const newKey = Object.entries(keyMappings).find(([oldKey, _]) => 
              key.startsWith(oldKey)
            );
            
            newProperties[newKey ? newKey[1] : key] = value;
          });
          feature.properties = newProperties;
        }

        return {
          ...newFeature,
          ...feature
        };
      })
    };

    const blob = new Blob([JSON.stringify(resultGeoJson, null, 2)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <DropZone
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        GeoJSON 파일을 여기에 드래그 앤 드롭하세요
      </DropZone>

      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="files">
          {(provided) => (
            <FileList
              {...provided.droppableProps}
              ref={provided.innerRef}
            >
              {files.map((file, index) => (
                <Draggable key={file.name} draggableId={file.name} index={index}>
                  {(provided) => (
                    <FileItem
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      {...provided.dragHandleProps}
                    >
                      {file.name}
                    </FileItem>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </FileList>
          )}
        </Droppable>
      </DragDropContext>

      <MergeButton onClick={handleMerge}>
        결합
      </MergeButton>
    </div>
  );
}

export default App;
