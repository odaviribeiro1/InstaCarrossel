import { useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Rect, Text, Circle, Line, Star, Arrow, RegularPolygon, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import { useEditorStore, type EditorElement } from '@/stores/editor-store';
import type Konva from 'konva';

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;

function ImageElement({ element, commonProps }: { element: EditorElement; commonProps: Record<string, unknown> }) {
  const [image] = useImage(String(element.attrs.src ?? ''), 'anonymous');
  const { src: _src, ...restProps } = commonProps as Record<string, unknown> & { src?: string };
  return <KonvaImage image={image} {...restProps} />;
}

export function EditorCanvas() {
  const {
    slides,
    activeSlideIndex,
    selectedElementId,
    zoom,
    selectElement,
    updateElement,
  } = useEditorStore();

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);

  const activeSlide = slides[activeSlideIndex];

  // Update transformer when selection changes
  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) return;

    if (!selectedElementId) {
      transformer.nodes([]);
      transformer.getLayer()?.batchDraw();
      return;
    }

    const stage = stageRef.current;
    if (!stage) return;

    const node = stage.findOne(`#${selectedElementId}`);
    if (node) {
      transformer.nodes([node]);
      transformer.getLayer()?.batchDraw();
    }
  }, [selectedElementId]);

  // Handle keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useEditorStore.getState();
        if (state.selectedElementId) {
          // Don't delete if editing text
          const activeEl = document.activeElement;
          if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) return;
          state.removeElement(state.selectedElementId);
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().undo();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        useEditorStore.getState().redo();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStageClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      if (e.target === e.target.getStage()) {
        selectElement(null);
      }
    },
    [selectElement]
  );

  const handleDragEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<DragEvent>) => {
      updateElement(id, { x: e.target.x(), y: e.target.y() });
    },
    [updateElement]
  );

  const handleTransformEnd = useCallback(
    (id: string, e: Konva.KonvaEventObject<Event>) => {
      const node = e.target;
      updateElement(id, {
        x: node.x(),
        y: node.y(),
        width: Math.max(5, node.width() * node.scaleX()),
        height: Math.max(5, node.height() * node.scaleY()),
        rotation: node.rotation(),
        scaleX: 1,
        scaleY: 1,
      });
    },
    [updateElement]
  );

  function renderElement(element: EditorElement) {
    if (!element.visible) return null;

    const commonProps = {
      id: element.id,
      key: element.id,
      ...element.attrs,
      draggable: !element.locked,
      onClick: () => selectElement(element.id),
      onTap: () => selectElement(element.id),
      onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => handleDragEnd(element.id, e),
      onTransformEnd: (e: Konva.KonvaEventObject<Event>) => handleTransformEnd(element.id, e),
    };

    switch (element.type) {
      case 'Rect':
        return <Rect {...commonProps} />;
      case 'Text':
        return (
          <Text
            {...commonProps}
            onDblClick={(e) => {
              // Enable inline text editing
              const textNode = e.target as Konva.Text;
              const stage = textNode.getStage();
              if (!stage) return;

              const textPosition = textNode.absolutePosition();
              const stageBox = stage.container().getBoundingClientRect();

              const textarea = document.createElement('textarea');
              document.body.appendChild(textarea);

              textarea.value = textNode.text();
              textarea.style.position = 'absolute';
              textarea.style.top = `${stageBox.top + textPosition.y * zoom}px`;
              textarea.style.left = `${stageBox.left + textPosition.x * zoom}px`;
              textarea.style.width = `${(textNode.width() * zoom)}px`;
              textarea.style.fontSize = `${(textNode.fontSize() ?? 16) * zoom}px`;
              textarea.style.border = '2px solid #6366f1';
              textarea.style.padding = '4px';
              textarea.style.margin = '0';
              textarea.style.overflow = 'hidden';
              textarea.style.background = 'white';
              textarea.style.outline = 'none';
              textarea.style.resize = 'none';
              textarea.style.fontFamily = String(textNode.fontFamily());
              textarea.style.zIndex = '1000';

              textarea.focus();

              function removeTextarea() {
                updateElement(element.id, { text: textarea.value });
                if (textarea.parentNode) {
                  textarea.parentNode.removeChild(textarea);
                }
              }

              textarea.addEventListener('blur', removeTextarea);
              textarea.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape') {
                  removeTextarea();
                }
              });
            }}
          />
        );
      case 'Circle':
        return <Circle {...commonProps} />;
      case 'Line':
        return <Line {...commonProps} />;
      case 'Star':
        return <Star numPoints={5} innerRadius={30} outerRadius={60} {...commonProps} />;
      case 'Arrow':
        return <Arrow points={[0, 0, 100, 0]} {...commonProps} />;
      case 'RegularPolygon':
        return <RegularPolygon sides={3} radius={60} {...commonProps} />;
      case 'Image':
        return <ImageElement element={element} commonProps={commonProps} />;
      default:
        return null;
    }
  }

  if (!activeSlide) {
    return (
      <div className="flex h-full items-center justify-center text-[#94A3B8]">
        Nenhum slide selecionado
      </div>
    );
  }

  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-[rgba(15,18,35,0.6)]/30 p-8">
      <div
        style={{
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        <Stage
          ref={stageRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          onClick={handleStageClick}
          style={{ border: '1px solid #e5e7eb', borderRadius: '4px', backgroundColor: 'white' }}
        >
          <Layer>
            {/* Background */}
            <Rect
              x={0}
              y={0}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              fill={activeSlide.backgroundColor}
              listening={false}
            />
            {/* Elements */}
            {activeSlide.elements.map(renderElement)}
            {/* Transformer */}
            <Transformer ref={transformerRef} />
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
