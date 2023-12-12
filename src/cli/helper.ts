export const asyncFlatMap = async <ItemType>(
  array: ItemType[],
  callback: (item: ItemType, index: number, array: ItemType[]) => Promise<ReadonlyArray<ItemType>>,
): Promise<ItemType[]> => {
  const mappedArray = await Promise.all(array.map(callback))
  const result = mappedArray.flat()
  return result
}
